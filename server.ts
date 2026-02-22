import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendance.db");
db.pragma('foreign_keys = ON');

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint_id INTEGER UNIQUE,
    role TEXT CHECK(role IN ('admin', 'teacher', 'student', 'staff')) NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    profile_picture TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS students (
    user_id INTEGER PRIMARY KEY,
    roll_number TEXT UNIQUE NOT NULL,
    enrollment_date DATE,
    department_id INTEGER,
    current_semester INTEGER,
    parent_name TEXT,
    parent_phone TEXT,
    address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS teachers (
    user_id INTEGER PRIMARY KEY,
    employee_id TEXT UNIQUE NOT NULL,
    hire_date DATE,
    department_id INTEGER,
    qualification TEXT,
    specialization TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    head_teacher_id INTEGER,
    FOREIGN KEY (head_teacher_id) REFERENCES teachers(user_id)
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    department_id INTEGER,
    credits INTEGER,
    semester INTEGER,
    FOREIGN KEY (department_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    credits INTEGER,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS timetables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    module_id INTEGER,
    teacher_id INTEGER NOT NULL,
    day_of_week TEXT CHECK(day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')) NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT,
    academic_year TEXT NOT NULL,
    semester INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (module_id) REFERENCES modules(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(user_id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    timetable_id INTEGER,
    course_id INTEGER NOT NULL,
    module_id INTEGER,
    sign_in_time DATETIME NOT NULL,
    sign_out_time DATETIME,
    duration_minutes INTEGER,
    status TEXT CHECK(status IN ('present', 'partial', 'late', 'absent', 'excused')) DEFAULT 'present',
    verification_method TEXT CHECK(verification_method IN ('fingerprint', 'manual', 'qr')) DEFAULT 'fingerprint',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(user_id),
    FOREIGN KEY (timetable_id) REFERENCES timetables(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (module_id) REFERENCES modules(id)
  );

  CREATE TABLE IF NOT EXISTS custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_type TEXT CHECK(field_type IN ('text', 'number', 'date', 'boolean', 'email')) DEFAULT 'text',
    is_active INTEGER DEFAULT 1,
    UNIQUE(table_name, field_name)
  );

  CREATE TABLE IF NOT EXISTS custom_field_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    custom_field_id INTEGER NOT NULL,
    record_id INTEGER NOT NULL,
    field_value TEXT,
    FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    leave_type TEXT CHECK(leave_type IN ('sick', 'casual', 'emergency', 'other')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Leaves API
  app.get("/api/leaves", (req, res) => {
    const leaves = db.prepare(`
      SELECT l.*, u.name as user_name, u.role as user_role
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
    `).all();
    res.json(leaves);
  });

  app.post("/api/leaves", (req, res) => {
    const { user_id, leave_type, start_date, end_date, reason } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO leaves (user_id, leave_type, start_date, end_date, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(user_id, leave_type, start_date, end_date, reason);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/leaves/:id", (req, res) => {
    const { status, approved_by } = req.body;
    const { id } = req.params;
    try {
      db.prepare("UPDATE leaves SET status = ?, approved_by = ? WHERE id = ?")
        .run(status, approved_by, id);
      
      // If approved, we could automatically mark attendance as 'excused' for those dates
      // but for now just update the status
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Auth (Mock for now)
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    // In a real app, verify password hash
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (user) {
      res.json({ user, token: "mock-jwt-token" });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Users
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.post("/api/users", (req, res) => {
    const { name, email, role, fingerprint_id } = req.body;
    try {
      const result = db.prepare("INSERT INTO users (name, email, role, fingerprint_id) VALUES (?, ?, ?, ?)").run(name, email, role, fingerprint_id);
      const userId = result.lastInsertRowid;
      
      // Automatically create entry in role-specific tables
      if (role === 'student') {
        db.prepare("INSERT INTO students (user_id, roll_number) VALUES (?, ?)").run(userId, `STU${userId}`);
      } else if (role === 'teacher') {
        db.prepare("INSERT INTO teachers (user_id, employee_id) VALUES (?, ?)").run(userId, `EMP${userId}`);
      }
      
      // Notify admins if a new admin is added
      if (role === 'admin') {
        io.emit("admin_added", { name, email, added_at: new Date().toISOString() });
      }
      
      res.json({ id: userId });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/users/:id", (req, res) => {
    const { name, email, role, fingerprint_id, is_active } = req.body;
    const { id } = req.params;
    try {
      db.prepare("UPDATE users SET name = ?, email = ?, role = ?, fingerprint_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(name, email, role, fingerprint_id, is_active ? 1 : 0, id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Courses
  app.get("/api/courses", (req, res) => {
    const courses = db.prepare("SELECT * FROM courses").all();
    res.json(courses);
  });

  app.post("/api/courses", (req, res) => {
    const { name, code, department_id, credits, semester } = req.body;
    try {
      const result = db.prepare("INSERT INTO courses (name, code, department_id, credits, semester) VALUES (?, ?, ?, ?, ?)")
        .run(name, code, department_id || 1, credits || 3, semester || 1);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/courses/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM courses WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Teachers
  app.get("/api/teachers", (req, res) => {
    const teachers = db.prepare(`
      SELECT t.*, u.name, u.email 
      FROM teachers t
      JOIN users u ON t.user_id = u.id
    `).all();
    res.json(teachers);
  });

  // Attendance
  app.get("/api/attendance", (req, res) => {
    const attendance = db.prepare(`
      SELECT a.*, u.name as student_name, c.name as course_name, tu.name as teacher_name
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN courses c ON a.course_id = c.id
      LEFT JOIN timetables t ON a.timetable_id = t.id
      LEFT JOIN users tu ON t.teacher_id = tu.id
      ORDER BY a.sign_in_time DESC
    `).all();
    res.json(attendance);
  });

  // Mark Attendance (Simulation endpoint for Fingerprint Sensor)
  app.post("/api/attendance/mark", (req, res) => {
    const { fingerprint_id, timestamp, teacher_id } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE fingerprint_id = ?").get(fingerprint_id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is already signed in today and hasn't signed out
    const today = new Date().toISOString().split('T')[0];
    const activeSession = db.prepare(`
      SELECT * FROM attendance 
      WHERE student_id = ? AND sign_out_time IS NULL AND date(sign_in_time) = date(?)
    `).get(user.id, timestamp || 'now');

    if (activeSession) {
      // Sign Out
      const signOutTime = timestamp || new Date().toISOString();
      const signInTime = new Date(activeSession.sign_in_time);
      const duration = Math.round((new Date(signOutTime).getTime() - signInTime.getTime()) / 60000);
      
      db.prepare("UPDATE attendance SET sign_out_time = ?, duration_minutes = ? WHERE id = ?")
        .run(signOutTime, duration, activeSession.id);
      
      const updated = { ...activeSession, sign_out_time: signOutTime, duration_minutes: duration, student_name: user.name, type: 'sign_out' };
      io.emit("attendance_update", updated);
      res.json(updated);
    } else {
      // Sign In
      // Find current lecture from timetable
      const now = new Date(timestamp || Date.now());
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
      const currentTime = now.toTimeString().split(' ')[0];

      let lectureQuery = `
        SELECT * FROM timetables 
        WHERE day_of_week = ? AND start_time <= ? AND end_time >= ?
      `;
      let params = [dayOfWeek, currentTime, currentTime];

      if (teacher_id) {
        lectureQuery += ` AND teacher_id = ?`;
        params.push(teacher_id);
      }

      const lecture = db.prepare(lectureQuery + " LIMIT 1").get(...params) as any;

      if (teacher_id && !lecture) {
        return res.status(403).json({ error: "You are not scheduled for a lecture at this time." });
      }

      const signInTime = timestamp || new Date().toISOString();
      const result = db.prepare(`
        INSERT INTO attendance (student_id, timetable_id, course_id, module_id, sign_in_time, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        user.id, 
        lecture?.id || null, 
        lecture?.course_id || 1, // Default course if none scheduled
        lecture?.module_id || null, 
        signInTime,
        'present'
      );

      const newRecord = { 
        id: result.lastInsertRowid, 
        student_id: user.id, 
        student_name: user.name, 
        sign_in_time: signInTime, 
        type: 'sign_in',
        course_name: lecture ? "Scheduled Lecture" : "Unscheduled"
      };
      io.emit("attendance_update", newRecord);
      res.json(newRecord);
    }
  });

  // Timetable
  app.get("/api/timetable", (req, res) => {
    const { teacher_id } = req.query;
    let query = `
      SELECT t.*, c.name as course_name, m.name as module_name, u.name as teacher_name
      FROM timetables t
      JOIN courses c ON t.course_id = c.id
      LEFT JOIN modules m ON t.module_id = m.id
      JOIN users u ON t.teacher_id = u.id
    `;
    
    if (teacher_id) {
      query += ` WHERE t.teacher_id = ?`;
      const timetable = db.prepare(query).all(teacher_id);
      return res.json(timetable);
    }
    
    const timetable = db.prepare(query).all();
    res.json(timetable);
  });

  // Lecture Reports
  app.get("/api/reports/lecture/:timetableId", (req, res) => {
    const { timetableId } = req.params;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_present,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN sign_out_time IS NOT NULL THEN 1 ELSE 0 END) as signed_out_count
      FROM attendance
      WHERE timetable_id = ? AND date(sign_in_time) = date('now')
    `).get(timetableId) as any;

    const totalStudents = db.prepare("SELECT COUNT(*) as count FROM students").get() as any;
    
    res.json({
      timetable_id: timetableId,
      total_class_size: totalStudents.count,
      present: stats.total_present || 0,
      late: stats.late_count || 0,
      signed_out: stats.signed_out_count || 0,
      absent: Math.max(0, totalStudents.count - (stats.total_present || 0)),
      attendance_percentage: totalStudents.count > 0 ? ((stats.total_present / totalStudents.count) * 100).toFixed(1) : 0
    });
  });

  app.post("/api/timetable", (req, res) => {
    const { course_id, module_id, teacher_id, day_of_week, start_time, end_time, room, academic_year, semester } = req.body;
    const result = db.prepare(`
      INSERT INTO timetables (course_id, module_id, teacher_id, day_of_week, start_time, end_time, room, academic_year, semester)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(course_id, module_id, teacher_id, day_of_week, start_time, end_time, room, academic_year, semester);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/timetable/import-cavendish", (req, res) => {
    const { csvData } = req.body;
    if (!csvData) return res.status(400).json({ error: "No data provided" });

    try {
      const lines = csvData.split('\n').filter((l: string) => l.trim());
      // Skip headers (first 3 lines in the provided text)
      const dataLines = lines.slice(3);
      
      const insertUser = db.prepare("INSERT OR IGNORE INTO users (name, email, role) VALUES (?, ?, ?)");
      const insertTeacher = db.prepare("INSERT OR IGNORE INTO teachers (user_id, employee_id) VALUES (?, ?)");
      const insertCourse = db.prepare("INSERT OR IGNORE INTO courses (name, code, department_id) VALUES (?, ?, ?)");
      const insertTimetable = db.prepare(`
        INSERT INTO timetables (course_id, teacher_id, day_of_week, start_time, end_time, room, academic_year, semester)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const results = db.transaction(() => {
        for (const line of dataLines) {
          const parts = line.split(',').map((p: string) => p.trim());
          if (parts.length < 9) continue;

          const [code, dayShort, timeRange, prog, code2, module, faculty, room, teacherName] = parts;
          
          // Map short day to full day
          const dayMap: { [key: string]: string } = {
            'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 
            'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
          };
          const day = dayMap[dayShort] || dayShort;

          // Split time range
          const [start, end] = timeRange.split('-').map(t => t.includes(':') ? t + ":00" : t.replace(/(\d+)/, "$1:00:00"));

          // 1. Create Teacher
          insertUser.run(teacherName || "Unknown Teacher", `${(teacherName || "unknown").replace(/\s/g, '').toLowerCase()}@cavendish.ac.ug`, 'teacher');
          const teacher = db.prepare("SELECT id FROM users WHERE name = ?").get(teacherName || "Unknown Teacher") as { id: number };
          insertTeacher.run(teacher.id, `EMP${teacher.id}`);

          // 2. Create Course
          insertCourse.run(module, code, 1);
          const course = db.prepare("SELECT id FROM courses WHERE code = ?").get(code) as { id: number };

          // 3. Create Timetable
          insertTimetable.run(course.id, teacher.id, day, start, end, room, "2023", 1);
        }
      })();

      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Seed initial data if empty
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const adminId = db.prepare("INSERT INTO users (name, email, role, fingerprint_id) VALUES (?, ?, ?, ?)").run("Admin User", "admin@school.com", "admin", 1).lastInsertRowid;
    const studentId = db.prepare("INSERT INTO users (name, email, role, fingerprint_id) VALUES (?, ?, ?, ?)").run("John Doe", "john@student.com", "student", 101).lastInsertRowid;
    const teacherId = db.prepare("INSERT INTO users (name, email, role, fingerprint_id) VALUES (?, ?, ?, ?)").run("Jane Smith", "jane@teacher.com", "teacher", 201).lastInsertRowid;
    
    // Insert into role-specific tables to satisfy foreign key constraints
    db.prepare("INSERT INTO students (user_id, roll_number) VALUES (?, ?)").run(studentId, "STU001");
    db.prepare("INSERT INTO teachers (user_id, employee_id) VALUES (?, ?)").run(teacherId, "EMP001");

    db.prepare("INSERT INTO departments (name, code, head_teacher_id) VALUES (?, ?, ?)").run("Computer Science", "CS", teacherId);
    db.prepare("INSERT INTO courses (name, code, department_id, credits, semester) VALUES (?, ?, ?, ?, ?)").run("Intro to Programming", "CS101", 1, 3, 1);
    db.prepare("INSERT INTO modules (course_id, name, code) VALUES (?, ?, ?)").run(1, "Python Basics", "MOD1");
    
    db.prepare(`
      INSERT INTO timetables (course_id, module_id, teacher_id, day_of_week, start_time, end_time, room, academic_year, semester)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, 1, teacherId, "Monday", "08:00:00", "10:00:00", "Room 101", "2024-2025", 1);
  }

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
