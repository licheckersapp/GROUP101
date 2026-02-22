/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  BarChart3, 
  Fingerprint, 
  FileUp, 
  FileDown, 
  Settings, 
  LogOut, 
  Search,
  Plus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  LayoutDashboard,
  BookOpen,
  UserCheck,
  Info,
  ArrowRight,
  ClipboardList,
  QrCode,
  Activity,
  Trash2,
  Edit,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

type Role = 'admin' | 'teacher' | 'student' | 'staff';

interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  fingerprint_id: number;
}

interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  course_name: string;
  sign_in_time: string;
  sign_out_time: string | null;
  duration_minutes: number | null;
  status: string;
}

interface TimetableEntry {
  id: number;
  course_name: string;
  module_name: string;
  teacher_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
}

// --- Components ---

const FileDropzone = ({ onFileSelect, label }: { onFileSelect: (file: File) => void, label: string }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer",
        isDragging ? "border-accent-theme bg-accent-soft-theme" : "border-theme hover:border-accent-theme/50"
      )}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) onFileSelect(file);
        };
        input.click();
      }}
    >
      <div className="w-16 h-16 bg-accent-soft-theme text-accent-theme rounded-full flex items-center justify-center mx-auto mb-4">
        <FileUp size={32} />
      </div>
      <h4 className="text-lg font-bold text-primary-theme mb-2">{label}</h4>
      <p className="text-sm text-secondary-theme max-w-xs mx-auto">
        Drag and drop your Excel or CSV file here, or click to browse.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-accent-theme bg-accent-soft-theme py-1 px-3 rounded-full w-fit mx-auto">
        <AlertCircle size={14} />
        Supports .CSV, .XLSX
      </div>
    </div>
  );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
      active 
        ? "bg-accent-theme text-white shadow-lg shadow-indigo-200" 
        : "text-secondary-theme hover:bg-accent-soft-theme hover:text-accent-theme"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const Card = ({ children, className, title, subtitle }: { children: React.ReactNode, className?: string, title?: string, subtitle?: string }) => (
  <div className={cn("card-theme rounded-2xl border shadow-sm overflow-hidden", className)}>
    {(title || subtitle) && (
      <div className="px-6 py-4 border-b border-theme">
        {title && <h3 className="text-lg font-semibold text-primary-theme">{title}</h3>}
        {subtitle && <p className="text-sm text-secondary-theme">{subtitle}</p>}
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, trend, color }: { label: string, value: string | number, icon: any, trend?: string, color: string }) => (
  <Card className="relative overflow-hidden">
    <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10", color)} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-secondary-theme mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-primary-theme">{value}</h3>
        {trend && (
          <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1">
            <ChevronRight size={12} className="-rotate-90" />
            {trend}
          </p>
        )}
      </div>
      <div className={cn("p-3 rounded-xl text-white", color)}>
        <Icon size={20} />
      </div>
    </div>
  </Card>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'timetable' | 'users' | 'analytics' | 'simulate' | 'settings' | 'leaves' | 'management'>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark' | 'green' | 'blue'>('light');
  const [user, setUser] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showManagementModal, setShowManagementModal] = useState<{ type: 'user' | 'course' | 'teacher', data?: any } | null>(null);
  const [managementFormData, setManagementFormData] = useState<any>({});
  
  // Advanced Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [importTarget, setImportTarget] = useState<'students' | 'teachers' | 'staff' | 'timetable'>('students');
  const [mappingFields, setMappingFields] = useState<{ [key: string]: string }>({});
  const [showMapping, setShowMapping] = useState(false);
  const [importedData, setImportedData] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [lectureReport, setLectureReport] = useState<any>(null);
  const [selectedTimetableId, setSelectedTimetableId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<{ id: string, message: string, type: 'info' | 'success' }[]>([]);

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  const teacherTimetable = useMemo(() => {
    if (!isTeacher) return [];
    return timetable.filter(t => t.teacher_id === user?.id);
  }, [timetable, user, isTeacher]);

  useEffect(() => {
    if (isTeacher && teacherTimetable.length > 0 && !selectedTimetableId) {
      setSelectedTimetableId(teacherTimetable[0].id);
    }
  }, [teacherTimetable, isTeacher, selectedTimetableId]);

  useEffect(() => {
    const fetchReport = async () => {
      if (selectedTimetableId) {
        const res = await fetch(`/api/reports/lecture/${selectedTimetableId}`);
        const data = await res.json();
        setLectureReport(data);
      }
    };
    fetchReport();
  }, [selectedTimetableId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleExport = () => {
    const headers = ['Student', 'Course', 'Sign In', 'Sign Out', 'Duration', 'Status'];
    const rows = attendance.map(r => [
      r.student_name,
      r.course_name,
      r.sign_in_time,
      r.sign_out_time || '',
      r.duration_minutes || '',
      r.status
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',');
      console.log("Detected headers:", headers);
      alert(`Importing ${lines.length - 1} records with fields: ${headers.join(', ')}`);
      // In a real app, send this to /api/users/import
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    // Initial Data Fetch
    const fetchData = async () => {
      try {
        const [attRes, ttRes, userRes, leaveRes, courseRes, teacherRes] = await Promise.all([
          fetch('/api/attendance'),
          fetch('/api/timetable'),
          fetch('/api/users'),
          fetch('/api/leaves'),
          fetch('/api/courses'),
          fetch('/api/teachers')
        ]);
        
        const attData = await attRes.json();
        const ttData = await ttRes.json();
        const userData = await userRes.json();
        const leaveData = await leaveRes.json();
        const courseData = await courseRes.json();
        const teacherData = await teacherRes.json();
        
        setAttendance(attData);
        setTimetable(ttData);
        setUsers(userData);
        setLeaves(leaveData);
        setCourses(courseData);
        setTeachers(teacherData);
        
        // Mock login for demo
        setUser(userData[0]);
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Socket Connection
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('attendance_update', (record: any) => {
      setAttendance(prev => {
        if (record.type === 'sign_out') {
          return prev.map(r => r.id === record.id ? { ...r, ...record } : r);
        }
        return [record, ...prev];
      });
    });

    newSocket.on('admin_added', (data: any) => {
      const id = Math.random().toString(36).substr(2, 9);
      setNotifications(prev => [{ id, message: `New Admin Added: ${data.name} (${data.email})`, type: 'success' }, ...prev]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 8000);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const filteredAttendance = useMemo(() => {
    return attendance.filter(record => {
      const matchesSearch = record.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           record.course_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const recordDate = record.sign_in_time.split('T')[0];
      const matchesDate = (!dateRange.start || recordDate >= dateRange.start) && 
                         (!dateRange.end || recordDate <= dateRange.end);
      
      return matchesSearch && matchesDate;
    });
  }, [attendance, searchQuery, dateRange]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.sign_in_time.startsWith(today));
    const presentCount = new Set(todayAttendance.map(a => a.student_id)).size;
    
    return {
      totalStudents: users.filter(u => u.role === 'student').length,
      presentToday: presentCount,
      avgAttendance: "84%",
      activeLectures: 4
    };
  }, [attendance, users]);

  const chartData = [
    { name: 'Mon', attendance: 45 },
    { name: 'Tue', attendance: 52 },
    { name: 'Wed', attendance: 48 },
    { name: 'Thu', attendance: 61 },
    { name: 'Fri', attendance: 55 },
  ];

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading Smart Attendance System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-72 card-theme border-r flex flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-accent-theme rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Fingerprint size={24} />
          </div>
          <div>
            <h1 className="font-bold text-primary-theme leading-tight">SmartCheck</h1>
            <p className="text-xs text-secondary-theme font-medium uppercase tracking-wider">Attendance System</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={UserCheck} 
            label="Live Attendance" 
            active={activeTab === 'attendance'} 
            onClick={() => setActiveTab('attendance')} 
          />
          <SidebarItem 
            icon={Calendar} 
            label="Timetable" 
            active={activeTab === 'timetable'} 
            onClick={() => setActiveTab('timetable')} 
          />
          {isAdmin && (
            <>
              <SidebarItem 
                icon={Users} 
                label="Students & Staff" 
                active={activeTab === 'users'} 
                onClick={() => setActiveTab('users')} 
              />
              <SidebarItem 
                icon={BarChart3} 
                label="Analytics" 
                active={activeTab === 'analytics'} 
                onClick={() => setActiveTab('analytics')} 
              />
            </>
          )}
          <SidebarItem 
            icon={ClipboardList} 
            label="Leave Requests" 
            active={activeTab === 'leaves'} 
            onClick={() => setActiveTab('leaves')} 
          />
          {isAdmin && (
            <>
              <SidebarItem 
                icon={ShieldCheck} 
                label="Management" 
                active={activeTab === 'management'} 
                onClick={() => setActiveTab('management')} 
              />
              <SidebarItem 
                icon={Settings} 
                label="Settings" 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')} 
              />
            </>
          )}
          <div className="pt-4 mt-4 border-t border-theme">
            <SidebarItem 
              icon={Fingerprint} 
              label="Student Registration" 
              active={activeTab === 'simulate'} 
              onClick={() => setActiveTab('simulate')} 
            />
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-theme">
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-accent-soft-theme flex items-center justify-center text-accent-theme font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary-theme truncate">{user?.name}</p>
              <p className="text-xs text-secondary-theme capitalize">{user?.role}</p>
            </div>
            <div className="flex gap-1">
              {['light', 'dark', 'green', 'blue'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t as any)}
                  className={cn(
                    "w-4 h-4 rounded-full border border-theme",
                    t === 'light' && "bg-white",
                    t === 'dark' && "bg-slate-900",
                    t === 'green' && "bg-emerald-500",
                    t === 'blue' && "bg-sky-500",
                    theme === t && "ring-2 ring-accent-theme ring-offset-2"
                  )}
                />
              ))}
            </div>
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200 font-medium">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-auto relative">
        {/* Notifications Overlay */}
        <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none">
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className={cn(
                  "pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md min-w-[320px]",
                  n.type === 'success' ? "bg-emerald-500/90 border-emerald-400 text-white" : "bg-white/90 border-theme text-primary-theme"
                )}
              >
                {n.type === 'success' ? <CheckCircle2 size={20} /> : <Info size={20} />}
                <div className="flex-1">
                  <p className="text-sm font-bold">{n.message}</p>
                </div>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                  className="p-1 hover:bg-black/10 rounded-full transition-colors"
                >
                  <XCircle size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <header className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-primary-theme capitalize">{activeTab}</h2>
            <p className="text-secondary-theme mt-1">Welcome back, here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-theme">
              <button 
                onClick={() => setUser(users.find(u => u.role === 'admin') || user)}
                className={cn("px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all", isAdmin ? "bg-white shadow-sm text-accent-theme" : "text-secondary-theme")}
              >
                ADMIN
              </button>
              <button 
                onClick={() => setUser(users.find(u => u.role === 'teacher') || user)}
                className={cn("px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all", isTeacher ? "bg-white shadow-sm text-accent-theme" : "text-secondary-theme")}
              >
                TEACHER
              </button>
            </div>
            <div className="flex items-center gap-2 bg-white card-theme border rounded-xl px-3 py-1.5">
              <Calendar size={16} className="text-secondary-theme" />
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-xs font-bold focus:outline-none text-primary-theme"
              />
              <span className="text-secondary-theme text-xs">to</span>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-xs font-bold focus:outline-none text-primary-theme"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-theme" size={18} />
              <input 
                type="text" 
                placeholder="Search records..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white card-theme border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-accent-theme text-white rounded-xl hover:opacity-90 transition-all shadow-lg shadow-indigo-100 font-medium">
              <Plus size={18} />
              <span>Add New</span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Students" value={stats.totalStudents} icon={Users} color="bg-indigo-600" trend="+12% from last month" />
                <StatCard label="Present Today" value={stats.presentToday} icon={CheckCircle2} color="bg-emerald-500" trend="On track" />
                <StatCard label="Avg. Attendance" value={stats.avgAttendance} icon={BarChart3} color="bg-amber-500" trend="-2% from last week" />
                <StatCard label="Active Lectures" value={stats.activeLectures} icon={BookOpen} color="bg-violet-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <Card title="Attendance Trends" subtitle="Weekly attendance overview">
                    <div className="h-80 w-full mt-4 min-h-[320px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                          <Tooltip 
                            cursor={{ fill: 'var(--accent-soft)' }}
                            contentStyle={{ backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="attendance" fill="var(--accent)" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Live Attendance Feed" subtitle="Real-time campus activity monitor">
                    <div className="space-y-4 mt-2">
                      {attendance.slice(0, 5).map((record, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-theme animate-in fade-in slide-in-from-left-4 duration-500">
                          <div className="w-10 h-10 rounded-full bg-accent-soft-theme text-accent-theme flex items-center justify-center font-bold">
                            {record.student_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-primary-theme truncate">{record.student_name}</p>
                            <p className="text-[10px] text-secondary-theme">
                              {record.course_name} • {record.teacher_name || 'TBA'} • {new Date(record.sign_in_time).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold uppercase">
                            <Activity size={12} className="animate-pulse" />
                            Live
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <Card title="Recent Activity" subtitle="Latest fingerprint scans">
                  <div className="space-y-6 mt-4">
                    {attendance.slice(0, 5).map((record, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          record.sign_out_time ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {record.sign_out_time ? <LogOut size={18} /> : <UserCheck size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-primary-theme truncate">{record.student_name}</p>
                          <p className="text-xs text-secondary-theme">{record.course_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-primary-theme">
                            {new Date(record.sign_out_time || record.sign_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-secondary-theme uppercase font-medium">
                            {record.sign_out_time ? 'Signed Out' : 'Signed In'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-8 py-2 text-sm font-medium text-accent-theme hover:bg-accent-soft-theme rounded-lg transition-colors">
                    View All Activity
                  </button>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div 
              key="attendance"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-end gap-2">
                <button 
                  onClick={handleExport}
                  className="px-4 py-2 bg-white card-theme border rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <FileDown size={16} />
                  Export CSV
                </button>
              </div>
              <Card title="Attendance Log" subtitle="Real-time tracking of all student movements">
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-accent-soft-theme border-y border-theme">
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Student</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Course</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Sign In</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Sign Out</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-theme">
                      {filteredAttendance.map((record) => (
                        <tr key={record.id} className="hover:bg-accent-soft-theme transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-accent-soft-theme text-accent-theme flex items-center justify-center font-bold text-xs">
                                {record.student_name.charAt(0)}
                              </div>
                              <span className="text-sm font-semibold text-primary-theme">{record.student_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-secondary-theme">{record.course_name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-secondary-theme">{new Date(record.sign_in_time).toLocaleTimeString()}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-secondary-theme">{record.sign_out_time ? new Date(record.sign_out_time).toLocaleTimeString() : '-'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-secondary-theme">{record.duration_minutes ? `${record.duration_minutes}m` : '-'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              record.sign_out_time ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {record.sign_out_time ? 'Completed' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'timetable' && (
            <motion.div 
              key="timetable"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <label className="px-4 py-2 bg-white card-theme border rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer">
                    <FileUp size={16} />
                    Import Timetable
                    <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
                  </label>
                  <button className="px-4 py-2 bg-white card-theme border rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                    <FileDown size={16} />
                    Export
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                  <div key={day}>
                    <Card title={day} className="h-fit">
                      <div className="space-y-4 mt-2">
                        {timetable.filter(t => t.day_of_week === day).map(entry => (
                          <div key={entry.id} className="p-4 rounded-xl bg-accent-soft-theme border border-theme relative group">
                            <button className="absolute top-2 right-2 p-1 text-secondary-theme opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical size={14} />
                            </button>
                            <p className="text-xs font-bold text-accent-theme mb-1">{entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}</p>
                            <h4 className="text-sm font-bold text-primary-theme">{entry.course_name}</h4>
                            <p className="text-xs text-secondary-theme mt-1">{entry.module_name}</p>
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-theme">
                              <div className="w-5 h-5 rounded-full bg-accent-theme text-white flex items-center justify-center text-[10px] font-bold">
                                {entry.teacher_name.charAt(0)}
                              </div>
                              <span className="text-[10px] text-secondary-theme font-medium">{entry.teacher_name}</span>
                              <span className="ml-auto text-[10px] text-secondary-theme font-medium">{entry.room}</span>
                            </div>
                          </div>
                        ))}
                        {timetable.filter(t => t.day_of_week === day).length === 0 && (
                          <div className="py-10 text-center">
                            <p className="text-xs text-secondary-theme italic">No classes scheduled</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-end gap-2">
                <label className="px-4 py-2 bg-white card-theme border rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer">
                  <FileUp size={16} />
                  Bulk Import Students
                  <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
                </label>
              </div>
              <Card title="User Directory" subtitle="Manage students, teachers and administrative staff">
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-accent-soft-theme border-y border-theme">
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Fingerprint ID</th>
                        <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-theme">
                      {filteredUsers.map((u) => (
                        <tr 
                          key={u.id} 
                          className="hover:bg-accent-soft-theme transition-colors cursor-pointer"
                          onClick={() => setSelectedUser(u)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-accent-soft-theme text-accent-theme flex items-center justify-center font-bold text-xs">
                                {u.name.charAt(0)}
                              </div>
                              <span className="text-sm font-semibold text-primary-theme">{u.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-secondary-theme">{u.email}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-secondary-theme capitalize">{u.role}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-secondary-theme">{u.fingerprint_id}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'simulate' && (
            <motion.div 
              key="simulate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <Card title="Student Registration (IOT Simulator)" subtitle={isTeacher ? "Register students for your assigned courses" : "Test the attendance logic without physical hardware"}>
                <div className="space-y-8 py-6">
                  {isTeacher && (
                    <div className="p-4 bg-accent-soft-theme rounded-xl border border-theme">
                      <label className="block text-xs font-bold text-secondary-theme uppercase mb-2">Select Active Course Unit</label>
                      <select 
                        value={selectedTimetableId || ''} 
                        onChange={(e) => setSelectedTimetableId(Number(e.target.value))}
                        className="w-full bg-white border border-theme rounded-lg px-3 py-2 text-sm font-bold text-primary-theme focus:outline-none focus:ring-2 focus:ring-accent-theme/20"
                      >
                        {teacherTimetable.map(t => (
                          <option key={t.id} value={t.id}>{t.course_name} - {t.module_name || 'General'}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                    <div className="bg-slate-900 rounded-2xl p-8 text-center relative overflow-hidden flex flex-col justify-center">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.2),transparent)]" />
                      <div className="relative z-10">
                        <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-indigo-500/30 animate-pulse">
                          <Fingerprint size={40} className="text-indigo-400" />
                        </div>
                        <h4 className="text-white font-bold text-lg mb-2">Fingerprint Scanner</h4>
                        <p className="text-slate-400 text-xs">Simulate a biometric touch</p>
                      </div>
                    </div>

                    <div className="bg-white card-theme border rounded-2xl p-8 text-center flex flex-col justify-center">
                      <div className="w-20 h-20 bg-accent-soft-theme rounded-2xl flex items-center justify-center mx-auto mb-6 border border-theme">
                        <QrCode size={40} className="text-accent-theme" />
                      </div>
                      <h4 className="text-primary-theme font-bold text-lg mb-2">QR Code Backup</h4>
                      <p className="text-secondary-theme text-xs">Generate dynamic code for mobile check-in</p>
                      <button className="mt-4 text-xs font-bold text-accent-theme hover:underline">
                        Generate New Code
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-primary-theme uppercase tracking-wider">Select Student to Register</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {users.filter(u => u.role === 'student').map(student => (
                        <button
                          key={student.id}
                          onClick={async () => {
                            const res = await fetch('/api/attendance/mark', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                fingerprint_id: student.fingerprint_id,
                                teacher_id: user?.id,
                                timetable_id: selectedTimetableId
                              })
                            });
                            const data = await res.json();
                            if (data.error) {
                              alert(data.error);
                            } else {
                              alert(`${data.type === 'sign_in' ? 'Signed In' : 'Signed Out'}: ${student.name}`);
                              // Refresh report
                              if (selectedTimetableId) {
                                const repRes = await fetch(`/api/reports/lecture/${selectedTimetableId}`);
                                const repData = await repRes.json();
                                setLectureReport(repData);
                              }
                            }
                          }}
                          className="flex items-center gap-3 p-4 rounded-xl border border-theme hover:border-accent-theme hover:bg-accent-soft-theme transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-full bg-accent-soft-theme flex items-center justify-center text-accent-theme font-bold group-hover:bg-accent-theme group-hover:text-white transition-colors">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary-theme">{student.name}</p>
                            <p className="text-xs text-secondary-theme">ID: {student.fingerprint_id}</p>
                          </div>
                          <ChevronRight size={16} className="ml-auto text-secondary-theme group-hover:text-accent-theme transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {lectureReport && (
                    <div className="mt-8 p-6 bg-accent-soft-theme rounded-2xl border border-accent-theme/20 space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-bold text-primary-theme">Physical Class Report</h4>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Live Session Stats</span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-theme">
                          <p className="text-[10px] font-bold text-secondary-theme uppercase mb-1">Signed In</p>
                          <p className="text-xl font-bold text-emerald-600">{lectureReport.present}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-theme">
                          <p className="text-[10px] font-bold text-secondary-theme uppercase mb-1">Late Arrivals</p>
                          <p className="text-xl font-bold text-amber-600">{lectureReport.late}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-theme">
                          <p className="text-[10px] font-bold text-secondary-theme uppercase mb-1">Absent</p>
                          <p className="text-xl font-bold text-red-600">{lectureReport.absent}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-theme">
                          <p className="text-[10px] font-bold text-secondary-theme uppercase mb-1">Attendance %</p>
                          <p className="text-xl font-bold text-accent-theme">{lectureReport.attendance_percentage}%</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-theme flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                              <UserCheck size={16} />
                            </div>
                            <p className="text-xs font-bold text-primary-theme">Early Arrivals</p>
                          </div>
                          <p className="text-sm font-bold text-emerald-600">{Math.max(0, lectureReport.present - lectureReport.late)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-theme flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                              <LogOut size={16} />
                            </div>
                            <p className="text-xs font-bold text-primary-theme">Signed Out</p>
                          </div>
                          <p className="text-sm font-bold text-blue-600">{lectureReport.signed_out}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-accent-theme/10">
                        <p className="text-xs text-secondary-theme">Total Physical Class Size: <strong>{lectureReport.total_class_size}</strong></p>
                        <div className="flex gap-3">
                          <button className="text-xs font-bold text-accent-theme hover:underline">View Full List</button>
                          <button className="text-xs font-bold text-accent-theme hover:underline">Export Report</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                    <AlertCircle className="text-amber-600 shrink-0" size={20} />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <strong>IOT Note:</strong> Teachers can only register students for their assigned courses. Biometric data is processed securely via the IOT gateway.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'leaves' && (
            <motion.div 
              key="leaves"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-primary-theme">Leave Management</h3>
                {user?.role === 'student' && (
                  <button className="flex items-center gap-2 px-4 py-2 bg-accent-theme text-white rounded-xl font-medium shadow-lg shadow-indigo-100">
                    <Plus size={18} />
                    Request Leave
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <Card title="Leave Applications" subtitle="Review and manage student/staff leave requests">
                    <div className="overflow-x-auto -mx-6">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-accent-soft-theme border-y border-theme">
                            <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Applicant</th>
                            <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Type</th>
                            <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Dates</th>
                            <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y border-theme">
                          {leaves.map((l) => (
                            <tr key={l.id} className="hover:bg-accent-soft-theme transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-accent-soft-theme text-accent-theme flex items-center justify-center font-bold text-xs">
                                    {l.user_name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-primary-theme">{l.user_name}</p>
                                    <p className="text-[10px] text-secondary-theme uppercase">{l.user_role}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-secondary-theme capitalize">{l.leave_type}</span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-xs font-bold text-primary-theme">{l.start_date}</p>
                                <p className="text-[10px] text-secondary-theme">to {l.end_date}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                  l.status === 'approved' && "bg-emerald-100 text-emerald-700",
                                  l.status === 'pending' && "bg-amber-100 text-amber-700",
                                  l.status === 'rejected' && "bg-red-100 text-red-700"
                                )}>
                                  {l.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {l.status === 'pending' && user?.role === 'admin' && (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={async () => {
                                        await fetch(`/api/leaves/${l.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ status: 'approved', approved_by: user.id })
                                        });
                                        setLeaves(prev => prev.map(item => item.id === l.id ? { ...item, status: 'approved' } : item));
                                      }}
                                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    >
                                      <CheckCircle2 size={16} />
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        await fetch(`/api/leaves/${l.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ status: 'rejected', approved_by: user.id })
                                        });
                                        setLeaves(prev => prev.map(item => item.id === l.id ? { ...item, status: 'rejected' } : item));
                                      }}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card title="Leave Statistics" subtitle="Overview of current leave trends">
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-accent-soft-theme border border-theme">
                        <p className="text-xs text-secondary-theme font-bold uppercase mb-1">Total Pending</p>
                        <p className="text-2xl font-bold text-primary-theme">{leaves.filter(l => l.status === 'pending').length}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <p className="text-xs text-emerald-600 font-bold uppercase mb-1">Approved Today</p>
                        <p className="text-2xl font-bold text-emerald-700">2</p>
                      </div>
                    </div>
                  </Card>

                  <Card title="Leave Policy" subtitle="Quick reference for admin">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-theme mt-1.5" />
                        <p className="text-xs text-secondary-theme">Medical leaves require a doctor's note for more than 3 days.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-theme mt-1.5" />
                        <p className="text-xs text-secondary-theme">Emergency leaves must be approved within 24 hours.</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 max-w-4xl"
            >
              <Card title="System Settings" subtitle="Configure platform behavior and appearance">
                <div className="space-y-8">
                  <section>
                    <h4 className="text-sm font-bold text-primary-theme mb-4 uppercase tracking-wider">Appearance</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(['light', 'dark', 'green', 'blue'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={cn(
                            "p-4 rounded-2xl border-2 transition-all text-left",
                            theme === t ? "border-accent-theme bg-accent-soft-theme" : "border-theme hover:border-accent-theme/30"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full mb-3 border border-theme",
                            t === 'light' && "bg-white",
                            t === 'dark' && "bg-slate-900",
                            t === 'green' && "bg-emerald-500",
                            t === 'blue' && "bg-sky-500"
                          )} />
                          <p className="text-sm font-bold text-primary-theme capitalize">{t} Mode</p>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="pt-8 border-t border-theme">
                    <h4 className="text-sm font-bold text-primary-theme mb-4 uppercase tracking-wider">Data Import & Management</h4>
                    <div className="bg-accent-soft-theme p-6 rounded-2xl border border-accent-theme/20 mb-6">
                      <div className="flex gap-4">
                        <div className="p-3 bg-accent-theme text-white rounded-xl h-fit">
                          <Info size={24} />
                        </div>
                        <div>
                          <h5 className="font-bold text-primary-theme mb-1">Admin Instruction</h5>
                          <p className="text-sm text-secondary-theme leading-relaxed">
                            Use the dropzone below to import your <strong>Timetables</strong>, <strong>Student Profiles</strong>, or <strong>Staff Records</strong>. 
                            The system will automatically detect fields and allow you to map them to the database. 
                            Ensure your file has clear headers for better mapping.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-4 mb-4">
                        <p className="text-sm font-bold text-primary-theme">Import Target:</p>
                        <div className="flex bg-white card-theme border rounded-xl p-1">
                          {(['students', 'teachers', 'staff', 'timetable'] as const).map(target => (
                            <button
                              key={target}
                              onClick={() => setImportTarget(target)}
                              className={cn(
                                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                                importTarget === target ? "bg-accent-theme text-white" : "text-secondary-theme hover:bg-slate-50"
                              )}
                            >
                              {target}
                            </button>
                          ))}
                        </div>
                      </div>

                      <FileDropzone 
                        label={`Import ${importTarget.charAt(0).toUpperCase() + importTarget.slice(1)} Data`}
                        onFileSelect={(file) => {
                          const reader = new FileReader();
                          reader.onload = async (e) => {
                            const text = e.target?.result as string;
                            
                            // Special check for Cavendish Timetable
                            if (text.includes('CAVENDISH UNIVERSITY UGANDA')) {
                              if (confirm('Cavendish University Timetable detected. Import automatically?')) {
                                const res = await fetch('/api/timetable/import-cavendish', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ csvData: text })
                                });
                                if (res.ok) {
                                  alert('Cavendish Timetable imported successfully!');
                                  window.location.reload();
                                }
                                return;
                              }
                            }

                            const lines = text.split('\n').filter(l => l.trim());
                            const headers = lines[0].split(',').map(h => h.trim());
                            const data = lines.slice(1).map(line => {
                              const values = line.split(',').map(v => v.trim());
                              return headers.reduce((obj, header, i) => ({ ...obj, [header]: values[i] }), {});
                            });
                            setImportedData(data);
                            setShowMapping(true);
                          };
                          reader.readAsText(file);
                        }}
                      />
                    </div>
                  </section>
                </div>
              </Card>

              {showMapping && (
                <Card title="Field Mapping" subtitle="Map your file columns to system fields">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {Object.keys(importedData[0] || {}).map(header => (
                        <div key={header} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-theme">
                          <span className="text-sm font-medium text-secondary-theme">{header}</span>
                          <ArrowRight size={16} className="text-slate-300" />
                          <select 
                            className="bg-white border border-theme rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-accent-theme/20 outline-none"
                            onChange={(e) => setMappingFields(prev => ({ ...prev, [header]: e.target.value }))}
                          >
                            <option value="">Select Field...</option>
                            <option value="name">Full Name</option>
                            <option value="email">Email Address</option>
                            <option value="fingerprint_id">Fingerprint ID</option>
                            <option value="role">User Role</option>
                            <option value="course_name">Course Name</option>
                            <option value="room">Room Number</option>
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t border-theme">
                      <button 
                        onClick={() => setShowMapping(false)}
                        className="px-6 py-2 text-sm font-bold text-secondary-theme hover:bg-slate-50 rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          alert(`Successfully imported ${importedData.length} records to ${importTarget}!`);
                          setShowMapping(false);
                        }}
                        className="px-6 py-2 bg-accent-theme text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-100 hover:opacity-90 transition-all"
                      >
                        Confirm Import
                      </button>
                    </div>
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'management' && (
            <motion.div 
              key="management"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-primary-theme">System Management</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setManagementFormData({ role: 'student' });
                      setShowManagementModal({ type: 'user' });
                    }}
                    className="px-4 py-2 bg-accent-theme text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add User
                  </button>
                  <button 
                    onClick={() => {
                      setManagementFormData({});
                      setShowManagementModal({ type: 'course' });
                    }}
                    className="px-4 py-2 bg-white border border-theme text-primary-theme rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add Course
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <Card title="Users & Staff" subtitle="Manage system users, roles and permissions">
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-accent-soft-theme border-y border-theme">
                          <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Name</th>
                          <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Role</th>
                          <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Email</th>
                          <th className="px-6 py-4 text-xs font-bold text-secondary-theme uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-theme">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-accent-soft-theme transition-colors">
                            <td className="px-6 py-4 font-semibold text-primary-theme text-sm">{u.name}</td>
                            <td className="px-6 py-4 text-sm text-secondary-theme capitalize">{u.role}</td>
                            <td className="px-6 py-4 text-sm text-secondary-theme">{u.email}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    setManagementFormData(u);
                                    setShowManagementModal({ type: 'user', data: u });
                                  }}
                                  className="p-1.5 text-accent-theme hover:bg-accent-soft-theme rounded-lg transition-colors"
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (confirm('Are you sure you want to delete this user?')) {
                                      await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
                                      setUsers(prev => prev.filter(item => item.id !== u.id));
                                    }
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card title="Admin Management" subtitle="Add and manage system administrators">
                    <div className="space-y-6">
                      <div className="p-4 bg-accent-soft-theme rounded-xl border border-theme space-y-4">
                        <h4 className="text-sm font-bold text-primary-theme">Add New Administrator</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <input 
                            type="text" 
                            placeholder="Full Name"
                            className="w-full bg-white border border-theme rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-theme/20 outline-none"
                            id="new-admin-name"
                          />
                          <input 
                            type="email" 
                            placeholder="Email Address"
                            className="w-full bg-white border border-theme rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-theme/20 outline-none"
                            id="new-admin-email"
                          />
                          <button 
                            onClick={async () => {
                              const nameInput = document.getElementById('new-admin-name') as HTMLInputElement;
                              const emailInput = document.getElementById('new-admin-email') as HTMLInputElement;
                              
                              if (!nameInput.value || !emailInput.value) {
                                alert('Please fill in all fields');
                                return;
                              }

                              const res = await fetch('/api/users', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  name: nameInput.value,
                                  email: emailInput.value,
                                  role: 'admin',
                                  fingerprint_id: Math.floor(Math.random() * 10000) // Mock fingerprint
                                })
                              });

                              if (res.ok) {
                                const newUser = await res.json();
                                setUsers(prev => [...prev, { id: newUser.id, name: nameInput.value, email: emailInput.value, role: 'admin', fingerprint_id: 0 }]);
                                nameInput.value = '';
                                emailInput.value = '';
                                alert('Administrator added successfully! All admins have been notified.');
                              } else {
                                const err = await res.json();
                                alert(`Error: ${err.error}`);
                              }
                            }}
                            className="w-full py-2 bg-accent-theme text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-100 hover:opacity-90 transition-all"
                          >
                            Create Admin Account
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-secondary-theme uppercase tracking-wider">Current Administrators</h4>
                        <div className="space-y-2">
                          {users.filter(u => u.role === 'admin').map(admin => (
                            <div key={admin.id} className="flex items-center justify-between p-3 rounded-xl border border-theme bg-slate-50">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent-theme text-white flex items-center justify-center text-xs font-bold">
                                  {admin.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-primary-theme">{admin.name}</p>
                                  <p className="text-[10px] text-secondary-theme">{admin.email}</p>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">Active</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="Courses & Modules" subtitle="Manage academic curriculum">
                    <div className="space-y-4 mt-2">
                      {courses.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-theme hover:border-accent-theme transition-all group">
                          <div>
                            <p className="text-sm font-bold text-primary-theme">{c.name}</p>
                            <p className="text-xs text-secondary-theme">{c.code} • {c.credits} Credits</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setManagementFormData(c);
                                setShowManagementModal({ type: 'course', data: c });
                              }}
                              className="p-1 text-accent-theme hover:bg-accent-soft-theme rounded"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm('Delete this course?')) {
                                  await fetch(`/api/courses/${c.id}`, { method: 'DELETE' });
                                  setCourses(prev => prev.filter(item => item.id !== c.id));
                                }
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="Teachers & Faculty" subtitle="Manage teaching staff and assignments">
                    <div className="space-y-4 mt-2">
                      {teachers.map(t => (
                        <div key={t.user_id} className="flex items-center gap-4 p-4 rounded-xl border border-theme hover:border-accent-theme transition-all group">
                          <div className="w-10 h-10 rounded-full bg-accent-soft-theme text-accent-theme flex items-center justify-center font-bold">
                            {t.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-primary-theme">{t.name}</p>
                            <p className="text-xs text-secondary-theme">{t.email}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1 text-accent-theme hover:bg-accent-soft-theme rounded">
                              <Edit size={14} />
                            </button>
                            <button className="p-1 text-red-500 hover:bg-red-50 rounded">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Attendance by Course" subtitle="Comparison of student engagement across modules">
                  <div className="h-80 w-full mt-4 min-h-[320px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={[
                        { name: 'Programming', value: 88 },
                        { name: 'Database', value: 76 },
                        { name: 'Networking', value: 92 },
                        { name: 'Security', value: 84 },
                      ]} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={100} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" fill="var(--accent)" radius={[0, 6, 6, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Attendance Distribution" subtitle="Overall student presence breakdown">
                  <div className="h-80 w-full mt-4 flex items-center justify-center min-h-[320px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Present', value: 75 },
                            { name: 'Late', value: 15 },
                            { name: 'Absent', value: 10 },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {['Present', 'Late', 'Absent'].map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                          <span className="text-xs font-medium text-slate-600">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

          {selectedUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white card-theme rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
              >
                <div className="relative h-32 bg-accent-theme">
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                  >
                    <XCircle size={20} />
                  </button>
                  <div className="absolute -bottom-12 left-8">
                    <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-xl">
                      <div className="w-full h-full rounded-2xl bg-accent-soft-theme flex items-center justify-center text-accent-theme text-3xl font-bold">
                        {selectedUser.name.charAt(0)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-16 px-8 pb-8 space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-primary-theme">{selectedUser.name}</h3>
                    <p className="text-secondary-theme capitalize">{selectedUser.role} • ID: {selectedUser.fingerprint_id}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-theme">
                      <p className="text-[10px] font-bold text-secondary-theme uppercase mb-1">Attendance</p>
                      <p className="text-xl font-bold text-primary-theme">92%</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-theme">
                      <p className="text-[10px] font-bold text-secondary-theme uppercase mb-1">Late Days</p>
                      <p className="text-xl font-bold text-amber-600">3</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-theme">
                      <p className="text-[10px] font-bold text-secondary-theme uppercase mb-1">Absences</p>
                      <p className="text-xl font-bold text-red-600">2</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-primary-theme uppercase tracking-wider">Recent Activity</h4>
                    <div className="space-y-2">
                      {attendance.filter(a => a.student_id === selectedUser.id).slice(0, 3).map(record => (
                        <div key={record.id} className="flex items-center justify-between p-3 rounded-xl border border-theme">
                          <div>
                            <p className="text-sm font-bold text-primary-theme">{record.course_name}</p>
                            <p className="text-[10px] text-secondary-theme">{new Date(record.sign_in_time).toLocaleDateString()}</p>
                          </div>
                          <span className="text-xs font-bold text-emerald-600">Present</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button className="flex-1 py-3 bg-accent-theme text-white rounded-xl font-bold shadow-lg shadow-indigo-100">
                      Edit Profile
                    </button>
                    <button className="flex-1 py-3 border border-theme text-secondary-theme rounded-xl font-bold hover:bg-slate-50">
                      View Full Report
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {showManagementModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white card-theme rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-theme flex items-center justify-between">
                  <h3 className="text-xl font-bold text-primary-theme capitalize">
                    {showManagementModal.data ? 'Edit' : 'Add'} {showManagementModal.type}
                  </h3>
                  <button onClick={() => setShowManagementModal(null)} className="text-secondary-theme hover:text-primary-theme">
                    <XCircle size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {showManagementModal.type === 'user' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-secondary-theme uppercase">Full Name</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border border-theme rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent-theme/20 outline-none"
                          value={managementFormData.name || ''}
                          onChange={e => setManagementFormData({...managementFormData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-secondary-theme uppercase">Email</label>
                        <input 
                          type="email" 
                          className="w-full bg-slate-50 border border-theme rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent-theme/20 outline-none"
                          value={managementFormData.email || ''}
                          onChange={e => setManagementFormData({...managementFormData, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-secondary-theme uppercase">Role</label>
                        <select 
                          className="w-full bg-slate-50 border border-theme rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent-theme/20 outline-none"
                          value={managementFormData.role || 'student'}
                          onChange={e => setManagementFormData({...managementFormData, role: e.target.value})}
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </>
                  )}
                  {showManagementModal.type === 'course' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-secondary-theme uppercase">Course Name</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border border-theme rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent-theme/20 outline-none"
                          value={managementFormData.name || ''}
                          onChange={e => setManagementFormData({...managementFormData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-secondary-theme uppercase">Course Code</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border border-theme rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent-theme/20 outline-none"
                          value={managementFormData.code || ''}
                          onChange={e => setManagementFormData({...managementFormData, code: e.target.value})}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="p-6 bg-slate-50 border-t border-theme flex gap-3">
                  <button 
                    onClick={() => setShowManagementModal(null)}
                    className="flex-1 py-2 border border-theme text-secondary-theme rounded-xl font-bold text-sm hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      const method = showManagementModal.data ? 'PUT' : 'POST';
                      const url = showManagementModal.data 
                        ? `/api/${showManagementModal.type === 'user' ? 'users' : 'courses'}/${showManagementModal.data.id || showManagementModal.data.user_id}`
                        : `/api/${showManagementModal.type === 'user' ? 'users' : 'courses'}`;
                      
                      const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(managementFormData)
                      });
                      
                      if (res.ok) {
                        alert('Success!');
                        setShowManagementModal(null);
                        window.location.reload();
                      }
                    }}
                    className="flex-1 py-2 bg-accent-theme text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </div>
          )}
      </main>
    </div>
  );
}
