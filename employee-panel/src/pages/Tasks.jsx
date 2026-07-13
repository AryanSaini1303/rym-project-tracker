import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Search, Loader2, ChevronDown, ChevronRight, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { triggerPushNotification } from '../lib/push';
import './Tasks.css';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    todo: true,
    inprogress: true,
    review: false,
    done: false
  });

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchEmployeeTasks = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data: empData } = await supabase
      .from('employees')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!empData) {
      setIsLoading(false);
      return;
    }

    setEmployee(empData);

    // Step 1: Find all task IDs where this employee is a multi-assignee
    const { data: assigneeData } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('employee_id', empData.id);

    const taskIds = assigneeData ? assigneeData.map(a => a.task_id) : [];

    // Step 2: Fetch all tasks where they are either the primary assignee OR in the multi-assignee list
    let query = supabase
      .from('tasks')
      .select(`
        *,
        projects (
          title
        ),
        task_assignees (
          employee_id,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (taskIds.length > 0) {
      // Using OR condition to capture both legacy assignments and new group assignments
      query = query.or(`assignee_id.eq.${empData.id},id.in.(${taskIds.join(',')})`);
    } else {
      query = query.eq('assignee_id', empData.id);
    }

    const { data: tasksData, error } = await query;

    if (error) {
      console.error("Error fetching tasks:", error);
    }

    if (!error && tasksData) {
      const formatted = tasksData.map(t => ({
        id: t.id,
        title: t.title,
        desc: t.description || 'No description provided.',
        status: t.task_assignees ? t.task_assignees.find(ta => ta.employee_id === empData.id)?.status || 'todo' : t.status,
        due_date: t.due_date,
        points_awarded: t.points_awarded,
        projectName: t.projects?.title,
        completed_at: t.completed_at
      }));
      setTasks(formatted);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEmployeeTasks();
  }, []);

  const handleStatusChange = async (taskId, newStatus) => {
    let points = 0;
    let completedAt = null;

    if (newStatus === 'done') {
      completedAt = new Date().toISOString();
      // Retrieve points configuration value
      const { data: configData } = await supabase
        .from('points_config')
        .select('points_value')
        .eq('rule_key', 'taskDone')
        .single();

      if (configData) {
        points = configData.points_value;
      } else {
        points = 15; // fallback
      }
    }

    // Update the specific employee's status in the task_assignees table
    const { error } = await supabase
      .from('task_assignees')
      .update({
        status: newStatus
      })
      .match({ task_id: taskId, employee_id: employee.id });

    // Also update the global task completed_at and points if needed
    if (completedAt) {
      await supabase.from('tasks').update({
        completed_at: completedAt,
        points_awarded: points
      }).eq('id', taskId);
    }

    if (!error) {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus, points_awarded: points } : t));
      toast.success('Task status updated successfully!');
      
      // Notify admins if task is ready for review or completed
      if (newStatus === 'review' || newStatus === 'done') {
        const taskName = tasks.find(t => t.id === taskId)?.title || 'A task';
        const action = newStatus === 'review' ? 'submitted for review' : 'completed';
        const title = newStatus === 'review' ? 'Task Ready for Review' : 'Task Completed';
        
        const newNotification = [{
          user_id: null,
          title: title,
          message: `${employee?.name || 'An employee'} ${action}: "${taskName}"`,
          type: 'task',
          link: '/tasks'
        }];
        await supabase.from('notifications').insert(newNotification);
        await triggerPushNotification(newNotification);
      }
    } else {
      toast.error('Error updating task status: ' + error.message);
    }
  };

  const columns = [
    { key: 'todo', label: 'To Do', color: 'var(--primary)' },
    { key: 'inprogress', label: 'In Progress', color: '#3182ce' },
    { key: 'review', label: 'In Review', color: 'var(--warning)' },
    { key: 'done', label: 'Done', color: 'var(--secondary)' }
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="spinner" size={36} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>My Tasks Board</h1>
          <p className="page-subtitle" style={{ margin: 0, marginTop: '4px' }}>Track and update the status of your assigned field assignments.</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={() => setShowMissedModal(true)} style={{ border: '1px solid var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem 1rem', marginLeft: 'auto' }}>
          <AlertCircle size={18} /> Missed Deadlines
        </button>
      </div>

      {/* Filter and Search */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="input-wrapper" style={{ width: '100%' }}>
          <Search className="input-icon" size={18} style={{ left: '0.85rem' }} />
          <input
            type="text"
            className="filter-input"
            placeholder="Search tasks by title or description..."
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="task-stack-container">
        {columns.map((col) => {
          const colTasks = tasks.filter(t => t.status === col.key && (
            t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
            t.desc.toLowerCase().includes(searchTerm.toLowerCase())
          ));

          return (
            <div key={col.key} className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
              <div 
                className="stack-header"
                onClick={() => toggleSection(col.key)}
                style={{ 
                  cursor: 'pointer', 
                  padding: '1rem 1.25rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderBottom: expandedSections[col.key] ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {expandedSections[col.key] ? <ChevronDown size={20} color="var(--text-secondary)" /> : <ChevronRight size={20} color="var(--text-secondary)" />}
                  <h3 style={{ margin: 0, color: col.color, fontSize: '1.1rem' }}>{col.label}</h3>
                  <span className="task-count" style={{ backgroundColor: 'var(--bg-color)', padding: '0.1rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}>{colTasks.length}</span>
                </div>
              </div>
              
              {expandedSections[col.key] && (
                <div style={{ padding: '1.25rem' }}>
                  {colTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem 0' }}>
                      No tasks in this section.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                      {colTasks.map(task => (
                        <div key={task.id} className="task-card" style={{ borderLeftColor: col.color }}>
                          <h4 style={{ margin: 0, paddingBottom: '0.5rem', color: '#ffffff' }}>{task.title}</h4>
                          <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{task.desc}</p>
                          
                          {task.projectName && (
                            <div style={{ margin: '0.5rem 0', display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                              Project: {task.projectName}
                            </div>
                          )}

                          {/* Status selection */}
                          <div style={{ margin: '1rem 0 0.75rem 0' }}>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Update Status</label>
                            <select
                              className="filter-input"
                              style={{ width: '100%', fontSize: '0.78rem', padding: '0.4rem 0.6rem' }}
                              value={task.status}
                              onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            >
                              <option value="todo">To Do</option>
                              <option value="inprogress">In Progress</option>
                              <option value="review">In Review</option>
                              <option value="done">Done</option>
                            </select>
                          </div>

                          <div className="task-footer">
                            {(() => {
                              const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0)) && task.status !== 'done';
                              return (
                                <div className="flex items-center gap-1" style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: isOverdue ? 600 : 400 }}>
                                  {isOverdue ? <AlertCircle size={13} /> : <Calendar size={13} />} 
                                  {task.due_date ? new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '--'}
                                  {isOverdue && <span style={{ marginLeft: '4px' }}>Overdue!</span>}
                                </div>
                              );
                            })()}
                            {task.status === 'done' && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700 }}>
                                +{task.points_awarded} pts
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Missed Deadlines Record Modal */}
      {showMissedModal && ReactDOM.createPortal(
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowMissedModal(false); }} style={{ zIndex: 9999 }}>
          <div className="modal-window glass" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: '700px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <AlertCircle size={22} /> Missed Deadlines Record
              </h3>
              <button type="button" className="modal-close-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowMissedModal(false); }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMissedModal(false); }} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto', overflowX: 'auto', width: '100%', paddingRight: '4px' }}>
              <table className="custom-table" style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Task</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Due Date</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const missedTasks = tasks.filter(t => {
                      if (!t.due_date) return false;
                      const dueDate = new Date(t.due_date);
                      dueDate.setHours(23, 59, 59, 999);
                      if (t.status === 'done' || t.status === 'completed') {
                        if (t.completed_at && new Date(t.completed_at) > dueDate) return true;
                        return false;
                      } else {
                        return new Date() > dueDate;
                      }
                    });
                    
                    if (missedTasks.length === 0) {
                      return <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No missed deadlines recorded! 🎉</td></tr>;
                    }
                    
                    return missedTasks.map(task => (
                      <tr key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontWeight: 500 }}>{task.title}</td>
                        <td style={{ padding: '12px' }}>{new Date(task.due_date).toLocaleDateString()}</td>
                        <td style={{ padding: '12px' }}>
                          {task.status === 'done' || task.status === 'completed' 
                            ? <span style={{ color: 'var(--warning)', fontSize: '0.85rem', padding: '2px 8px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '4px' }}>Completed Late</span>
                            : <span style={{ color: 'var(--danger)', fontSize: '0.85rem', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>Overdue Now</span>}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tasks;
