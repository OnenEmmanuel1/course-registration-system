'use strict';
/**
 * UCRSystem Business Logic Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * ALL domain logic lives here, completely decoupled from HTTP routing.
 * Route handlers call these functions and translate results to HTTP responses.
 *
 * Functions exported:
 *   checkPrerequisites(db, studentId, courseId)         → { ok, missing[] }
 *   checkCreditLimit(db, studentId, semester, newCreditUnits) → { ok, current, max, min }
 *   validateCourseSelection(db, studentId, courseId, semester) → { ok, reason? }
 *   registerCourses(db, studentId, courseIds, semester) → { results[] }
 *   getStudentSchedule(db, studentId, semester)         → rows[]
 *   getLecturerSchedule(db, lecturerId, semester)       → rows[]
 *   getCreditPolicy(db)                                 → { min, max }
 *   getEnrollmentReport(db, semester)                   → rows[]
 *   getVenueUtilizationReport(db, semester)             → rows[]
 *   getCreditLoadReport(db, semester)                   → rows[]
 */

const pool = require('../config/db');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch the credit policy (min/max units per semester).
 * Falls back to env vars if the DB table is empty.
 */
async function getCreditPolicy(db = pool) {
  const [rows] = await db.execute('SELECT min_credits, max_credits FROM credit_policy LIMIT 1');
  if (rows.length > 0) {
    return { min: rows[0].min_credits, max: rows[0].max_credits };
  }
  return {
    min: parseInt(process.env.CREDIT_MIN || '12'),
    max: parseInt(process.env.CREDIT_MAX || '24'),
  };
}

// ─── Prerequisite Validation ──────────────────────────────────────────────────

/**
 * Check whether a student satisfies ALL prerequisites for a given course.
 *
 * @param {object} db     - mysql2 pool or connection
 * @param {number} studentId
 * @param {number} courseId
 * @returns {{ ok: boolean, missing: Array<{id,code,title}> }}
 */
async function checkPrerequisites(db = pool, studentId, courseId) {
  // Fetch all declared prerequisites for this course
  const [prereqs] = await db.execute(
    `SELECT c.id, c.code, c.title
     FROM course_prerequisites cp
     JOIN courses c ON c.id = cp.prerequisite_id
     WHERE cp.course_id = ?`,
    [courseId]
  );

  if (prereqs.length === 0) {
    return { ok: true, missing: [] };
  }

  // Fetch the set of course IDs the student has already completed (any grade except F)
  const [completed] = await db.execute(
    `SELECT course_id
     FROM completed_courses
     WHERE student_id = ? AND grade != 'F'`,
    [studentId]
  );

  const completedIds = new Set(completed.map(r => r.course_id));

  const missing = prereqs.filter(p => !completedIds.has(p.id));

  return {
    ok: missing.length === 0,
    missing,
  };
}

// ─── Credit-Limit Validation ──────────────────────────────────────────────────

/**
 * Check whether adding `newCreditUnits` would exceed the semester credit limit.
 *
 * @param {object} db
 * @param {number} studentId
 * @param {string} semester    - e.g. '2024/2025-1'
 * @param {number} newCreditUnits - credit units of the course being added
 * @returns {{ ok: boolean, current: number, proposed: number, min: number, max: number }}
 */
async function checkCreditLimit(db = pool, studentId, semester, newCreditUnits) {
  // Sum credit units of courses the student is already registered for this semester
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(c.credit_units), 0) AS total
     FROM registrations r
     JOIN courses c ON c.id = r.course_id
     WHERE r.student_id = ? AND r.semester = ? AND r.status != 'dropped'`,
    [studentId, semester]
  );

  const current = parseInt(rows[0].total || 0);
  const proposed = current + newCreditUnits;
  const policy = await getCreditPolicy(db);

  return {
    ok: proposed <= policy.max,
    current,
    proposed,
    min: policy.min,
    max: policy.max,
  };
}

// ─── Combined Course Validation ───────────────────────────────────────────────

/**
 * Validate a single course selection for a student.
 * Runs prerequisite check first, then credit-limit check.
 *
 * @param {object} db
 * @param {number} studentId
 * @param {number} courseId
 * @param {string} semester
 * @returns {{ ok: boolean, reason?: string, type?: 'prerequisite'|'credit_limit'|'already_registered', details?: object }}
 */
async function validateCourseSelection(db = pool, studentId, courseId, semester) {
  // 0. Check already registered
  const [existing] = await db.execute(
    `SELECT id FROM registrations
     WHERE student_id = ? AND course_id = ? AND semester = ? AND status != 'dropped'`,
    [studentId, courseId, semester]
  );
  if (existing.length > 0) {
    return {
      ok: false,
      type: 'already_registered',
      reason: 'You are already registered for this course in the current semester.',
    };
  }

  // 1. Prerequisite check
  const prereqResult = await checkPrerequisites(db, studentId, courseId);
  if (!prereqResult.ok) {
    const missingNames = prereqResult.missing.map(m => `${m.code} – ${m.title}`).join(', ');
    return {
      ok: false,
      type: 'prerequisite',
      reason: `Prerequisite(s) not satisfied. You must first complete: ${missingNames}.`,
      details: { missing: prereqResult.missing },
    };
  }

  // 2. Get course credit units for credit-limit check
  const [courseRows] = await db.execute(
    'SELECT credit_units FROM courses WHERE id = ?',
    [courseId]
  );
  if (courseRows.length === 0) {
    return { ok: false, type: 'not_found', reason: 'Course not found.' };
  }
  const creditUnits = courseRows[0].credit_units;

  // 3. Credit-limit check
  const creditResult = await checkCreditLimit(db, studentId, semester, creditUnits);
  if (!creditResult.ok) {
    return {
      ok: false,
      type: 'credit_limit',
      reason: `Adding this course (${creditUnits} units) would bring your total to ${creditResult.proposed} units, exceeding the maximum of ${creditResult.max} units per semester. Your current load is ${creditResult.current} units.`,
      details: {
        current: creditResult.current,
        proposed: creditResult.proposed,
        max: creditResult.max,
        courseUnits: creditUnits,
      },
    };
  }

  return { ok: true };
}

// ─── Course Registration ──────────────────────────────────────────────────────

/**
 * Register a student for multiple courses, validating each one individually.
 * Returns per-course results so the UI can show specific failures.
 *
 * @param {object} db
 * @param {number} studentId
 * @param {number[]} courseIds
 * @param {string}  semester
 * @returns {{ results: Array<{courseId, code, title, ok, reason?, type?}> }}
 */
async function registerCourses(db = pool, studentId, courseIds, semester) {
  const results = [];

  // Fetch course meta for all IDs in one query
  const placeholders = courseIds.map(() => '?').join(',');
  const [courseMeta] = await db.execute(
    `SELECT id, code, title, credit_units FROM courses WHERE id IN (${placeholders})`,
    courseIds
  );
  const courseMap = Object.fromEntries(courseMeta.map(c => [c.id, c]));

  // Use a connection so credit totals stay consistent within the loop
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const courseId of courseIds) {
      const meta = courseMap[courseId];
      if (!meta) {
        results.push({ courseId, code: '?', title: 'Unknown', ok: false, type: 'not_found', reason: 'Course not found.' });
        continue;
      }

      const validation = await validateCourseSelection(conn, studentId, courseId, semester);

      if (!validation.ok) {
        results.push({ courseId, code: meta.code, title: meta.title, ok: false, type: validation.type, reason: validation.reason, details: validation.details });
      } else {
        // Insert registration record
        await conn.execute(
          `INSERT INTO registrations (student_id, course_id, semester, status)
           VALUES (?, ?, ?, 'confirmed')
           ON DUPLICATE KEY UPDATE status='confirmed'`,
          [studentId, courseId, semester]
        );
        results.push({ courseId, code: meta.code, title: meta.title, ok: true });
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { results };
}

// ─── Schedule Queries ─────────────────────────────────────────────────────────

/**
 * Fetch a student's registered schedule for a semester (with venue & lecturer).
 */
async function getStudentSchedule(db = pool, studentId, semester) {
  const [rows] = await db.execute(
    `SELECT
       c.code, c.title, c.credit_units,
       v.name  AS venue_name, v.capacity AS venue_capacity,
       u.name  AS lecturer_name,
       t.day, t.start_time, t.end_time,
       r.registered_at, r.status
     FROM registrations r
     JOIN courses   c ON c.id = r.course_id
     LEFT JOIN timetable t ON t.course_id = r.course_id AND t.semester = r.semester
     LEFT JOIN venues    v ON v.id = t.venue_id
     LEFT JOIN users     u ON u.id = t.lecturer_id
     WHERE r.student_id = ? AND r.semester = ? AND r.status != 'dropped'
     ORDER BY
       FIELD(t.day,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
       t.start_time`,
    [studentId, semester]
  );
  return rows;
}

/**
 * Fetch a lecturer's teaching schedule for a semester.
 */
async function getLecturerSchedule(db = pool, lecturerId, semester) {
  const [rows] = await db.execute(
    `SELECT
       c.code, c.title, c.credit_units, c.department,
       v.name AS venue_name, v.capacity AS venue_capacity,
       t.day, t.start_time, t.end_time,
       (SELECT COUNT(*) FROM registrations r
        WHERE r.course_id = c.id AND r.semester = ? AND r.status != 'dropped') AS enrolled_count
     FROM timetable t
     JOIN courses c ON c.id = t.course_id
     JOIN venues  v ON v.id = t.venue_id
     WHERE t.lecturer_id = ? AND t.semester = ?
     ORDER BY
       FIELD(t.day,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
       t.start_time`,
    [semester, lecturerId, semester]
  );
  return rows;
}

// ─── Reporting ────────────────────────────────────────────────────────────────

/**
 * Enrollment report: enrolled student count per course for a semester.
 */
async function getEnrollmentReport(db = pool, semester) {
  const [rows] = await db.execute(
    `SELECT
       c.code, c.title, c.department, c.level, c.credit_units,
       COUNT(r.id) AS enrolled_count,
       v.name AS venue_name, v.capacity AS venue_capacity,
       u.name AS lecturer_name
     FROM courses c
     LEFT JOIN registrations r ON r.course_id = c.id AND r.semester = ? AND r.status != 'dropped'
     LEFT JOIN timetable t ON t.course_id = c.id AND t.semester = ?
     LEFT JOIN venues v ON v.id = t.venue_id
     LEFT JOIN users  u ON u.id = t.lecturer_id
     GROUP BY c.id, v.id, u.id
     ORDER BY c.department, c.level, c.code`,
    [semester, semester]
  );
  return rows;
}

/**
 * Venue utilization report: how full each venue is vs capacity.
 */
async function getVenueUtilizationReport(db = pool, semester) {
  const [rows] = await db.execute(
    `SELECT
       v.name AS venue_name, v.capacity,
       c.code, c.title,
       t.day, t.start_time, t.end_time,
       COUNT(r.id) AS enrolled_count,
       ROUND(COUNT(r.id) / v.capacity * 100, 1) AS utilization_pct
     FROM venues v
     LEFT JOIN timetable t ON t.venue_id = v.id AND t.semester = ?
     LEFT JOIN courses c ON c.id = t.course_id
     LEFT JOIN registrations r ON r.course_id = c.id AND r.semester = ? AND r.status != 'dropped'
     GROUP BY v.id, t.id
     ORDER BY v.name, t.day, t.start_time`,
    [semester, semester]
  );
  return rows;
}

/**
 * Credit-load distribution report: how many students have X credit units registered.
 */
async function getCreditLoadReport(db = pool, semester) {
  const [rows] = await db.execute(
    `SELECT
       u.name AS student_name, u.matric_no, u.department, u.level,
       COALESCE(SUM(c.credit_units), 0) AS total_credits,
       COUNT(r.id) AS course_count
     FROM users u
     LEFT JOIN registrations r ON r.student_id = u.id AND r.semester = ? AND r.status != 'dropped'
     LEFT JOIN courses c ON c.id = r.course_id
     WHERE u.role = 'student'
     GROUP BY u.id
     ORDER BY total_credits DESC`,
    [semester]
  );
  return rows;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  checkPrerequisites,
  checkCreditLimit,
  validateCourseSelection,
  registerCourses,
  getStudentSchedule,
  getLecturerSchedule,
  getCreditPolicy,
  getEnrollmentReport,
  getVenueUtilizationReport,
  getCreditLoadReport,
};
