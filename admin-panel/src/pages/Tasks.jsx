import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Calendar, Search, X, Edit, Trash, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { triggerPushNotification } from '../lib/push';


const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (key) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: prev[key] === false ? true : false
    }));
  };

  // Form states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskStatus, setTaskStatus] = useState('todo');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [taskProject, setTaskProject] = useState('');
  const [projects, setProjects] = useState([]);
  const [formError, setFormError] = useState('');

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name')
      .order('name');
    if (!error && data) {
      setEmployees(data);
      if (data.length > 0) {
        setTaskAssignee(data[0].id);
      }
    }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setProjects(data);
    }
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_assignees (
          status,
          employees (
            id,
            name
          )
        ),
        projects (
          title
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formatted = data.map(t => {
        const getCalculatedStatus = () => {
          if (!t.task_assignees || t.task_assignees.length === 0) return t.status ? t.status.replace('-', '') : 'todo';
          const allDone = t.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
          const allTodo = t.task_assignees.every(ta => !ta.status || ta.status === 'todo');
          if (allDone) return 'done';
          if (allTodo) return 'todo';
          if (t.task_assignees.some(ta => ta.status === 'review' || ta.status === 'in-review')) return 'review';
          return 'inprogress';
        };

        return {
          id: t.id,
          title: t.title,
          desc: t.description || '',
          status: getCalculatedStatus(),
          task_assignees: t.task_assignees || [],
          due_date: t.due_date,
          project_id: t.project_id,
          projectName: t.projects?.title,
          completed_at: t.completed_at
        };
      });
      setTasks(formatted);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
    fetchProjects();
    fetchTasks();
    
    const tasksSub = supabase
      .channel('public:tasks_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => fetchTasks())
      .subscribe();
      
    return () => supabase.removeChannel(tasksSub);
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!taskTitle.trim() || !taskDesc.trim()) {
      setFormError('Please enter both title and description.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (taskDate && taskDate < todayStr) {
      setFormError('Due date cannot be in the past.');
      return;
    }

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .insert([{
        title: taskTitle,
        description: taskDesc,
        status: taskStatus,
        due_date: taskDate,
        project_id: taskProject || null
      }])
      .select();

    if (taskError || !taskData) {
      setFormError(taskError?.message || 'Failed to create task');
      toast.error('Failed to create task');
      return;
    }
    
    const newTask = taskData[0];

    if (taskAssignee) {
      await supabase.from('task_assignees').insert([{
        task_id: newTask.id,
        employee_id: taskAssignee,
        status: taskStatus
      }]);
      
      const newNotification = [{
        user_id: taskAssignee,
        title: 'New Task Assigned',
        message: `You have been assigned a new task: "${taskTitle}"`,
        type: 'task',
        link: '/tasks'
      }];
      await supabase.from('notifications').insert(newNotification);
      await triggerPushNotification(newNotification);
    }

    fetchTasks();
    setShowModal(false);

    setTaskTitle('');
    setTaskDesc('');
    setTaskStatus('todo');
    setTaskAssignee(employees.length > 0 ? employees[0].id : '');
    setTaskProject('');
    setTaskDate(new Date().toISOString().split('T')[0]);
    toast.success('Task created successfully!');
  };

  const handleStatusChange = async (id, newStatus) => {
    const { error: taskError } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', id);

    const { error: assigneesError, data: assigneesData } = await supabase
      .from('task_assignees')
      .update({ status: newStatus })
      .eq('task_id', id)
      .select('employee_id');

    if (!taskError && !assigneesError) {
      // Notify assigned employees
      const taskName = tasks.find(t => t.id === id)?.title || 'A task';
      if (assigneesData && assigneesData.length > 0) {
        const notifications = assigneesData.map(a => ({
          user_id: a.employee_id,
          title: 'Task Status Updated',
          message: `Admin changed status of "${taskName}" to ${newStatus}`,
          type: 'task',
          link: '/tasks'
        }));
        await supabase.from('notifications').insert(notifications);
        await triggerPushNotification(notifications);
      }

      fetchTasks();
      toast.success('Task status overridden globally');
    } else {
      toast.error('Error updating task status');
    }
  };

  const handleDeleteTask = async (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Are you sure you want to delete this task?</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', transition: 'all 0.2s' }}>Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (!error) {
              setTasks(tasks.filter(t => t.id !== id));
              toast.success('Task deleted');
            } else {
              toast.error('Error deleting task: ' + error.message);
            }
          }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>Delete</button>
        </div>
      </div>
    ), { duration: 5000 });
  };


  const getStatusColor = (status) => {
    switch (status) {
      case 'done':
        return 'var(--secondary)';
      case 'inprogress':
        return '#3182ce';
      case 'review':
        return 'var(--warning)';
      case 'todo':
      default:
        return 'var(--primary)';
    }
  };

  const sections = [
    ...projects.map(p => ({
      key: p.id,
      label: p.title,
      color: 'var(--primary)'
    })),
    {
      key: 'no-project',
      label: 'General Tasks (No Project)',
      color: 'var(--text-secondary)'
    }
  ];

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Tasks Board</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Manage and track project progress.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
          <button className="btn-secondary flex items-center gap-2" onClick={() => setShowMissedModal(true)} style={{ border: '1px solid var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
            <AlertCircle size={18} /> Missed Deadlines
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => {
            setTaskProject('');
            setTaskStatus('todo');
            setShowModal(true);
          }}>
            <Plus size={18} /> Create Task
          </button>
        </div>
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
        {sections.map((sec) => {
          const secTasks = tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  t.desc.toLowerCase().includes(searchTerm.toLowerCase());
            if (sec.key === 'no-project') {
              return !t.project_id && matchesSearch;
            }
            return t.project_id === sec.key && matchesSearch;
          });

          // Only render projects that have tasks OR show all projects if no search term is active
          if (secTasks.length === 0 && searchTerm) return null;

          const isExpanded = expandedSections[sec.key] !== false;

          return (
            <div key={sec.key} className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
              <div 
                className="stack-header"
                onClick={() => toggleSection(sec.key)}
                style={{ 
                  cursor: 'pointer', 
                  padding: '1rem 1.25rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isExpanded ? <ChevronDown size={20} color="var(--text-secondary)" /> : <ChevronRight size={20} color="var(--text-secondary)" />}
                  <h3 style={{ margin: 0, color: sec.color, fontSize: '1.1rem' }}>{sec.label}</h3>
                  <span className="task-count" style={{ backgroundColor: 'var(--bg-color)', padding: '0.1rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}>{secTasks.length}</span>
                </div>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setTaskProject(sec.key === 'no-project' ? '' : sec.key);
                    setTaskStatus('todo');
                    setShowModal(true);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                >
                  + Add Task
                </button>
              </div>
              
              {isExpanded && (
                <div style={{ padding: '1.25rem' }}>
                  {secTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem 0' }}>
                      No tasks in this project.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                      {secTasks.map(task => {
                        const statusColor = getStatusColor(task.status);
                        
                        return (
                          <div key={task.id} className="task-card" style={{ borderLeftColor: statusColor }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <h4 style={{ margin: 0, paddingRight: '0.5rem' }}>{task.title}</h4>
                              <button 
                                onClick={() => handleDeleteTask(task.id)} 
                                style={{ color: 'var(--danger)', opacity: 0.7, padding: '0.2rem' }}
                                title="Delete task"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <p style={{ marginTop: '0.5rem' }}>{task.desc}</p>
                            
                            {/* Display Task Status Badge inside card */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                              <span className={`status-badge ${task.status === 'done' ? 'completed' : task.status === 'inprogress' ? 'inprogress' : task.status === 'review' ? 'review' : 'pending'}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                                {task.status === 'done' ? 'Done' : task.status === 'inprogress' ? 'In Progress' : task.status === 'review' ? 'In Review' : 'To Do'}
                              </span>
                            </div>

                            {/* Column switcher */}
                            <div style={{ marginBottom: '0.75rem', marginTop: '0.5rem' }}>
                              <select
                                className="filter-input"
                                style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
                                value={task.status}
                                onChange={(e) => handleStatusChange(task.id, e.target.value)}
                              >
                                <option value="todo">To Do</option>
                                <option value="inprogress">In Progress</option>
                                <option value="review">In Review</option>
                                <option value="done">Done</option>
                              </select>
                            </div>

                            <div className="task-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                              <div className="task-row-actions" style={{ width: '100%' }}>
                                <div className="assignee-dropdown-container">
                                  {task.task_assignees && task.task_assignees.length > 0 ? (
                                    <div className="assignees-stack-badge" style={{ cursor: 'default', background: 'transparent', border: 'none', padding: 0 }}>
                                      <div className="avatars-stack" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {task.task_assignees.map((ta) => {
                                          const normalizedStatus = ta.status ? ta.status.replace('-', '') : 'todo';
                                          const percent = normalizedStatus === 'done' || normalizedStatus === 'completed' ? 100 : normalizedStatus === 'review' ? 75 : normalizedStatus === 'inprogress' ? 50 : 0;
                                          const color = normalizedStatus === 'done' || normalizedStatus === 'completed' ? 'var(--success)' : normalizedStatus === 'review' ? 'var(--warning)' : normalizedStatus === 'inprogress' ? '#3182ce' : 'var(--text-secondary)';
                                          return (
                                            <div key={ta.employees.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '6px', gap: '8px', flex: 1, minWidth: '140px' }}>
                                              <div className="assignee-avatar" style={{ width: '18px', height: '18px', fontSize: '0.6rem', border: 'none' }}>
                                                {ta.employees.name.charAt(0)}
                                              </div>
                                              <span style={{ fontSize: '0.75rem', width: '50px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ta.employees.name.split(' ')[0]}</span>
                                              
                                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                                  <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'all 0.5s ease' }}></div>
                                                </div>
                                                <span style={{ fontSize: '0.65rem', color: color, fontWeight: 600, width: '24px', textAlign: 'right' }}>{percent}%</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                      Unassigned
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {(() => {
                                const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0)) && task.status !== 'done';
                                return (
                                  <div className="flex items-center gap-1" style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: isOverdue ? 600 : 400 }}>
                                    {isOverdue ? <AlertCircle size={14} /> : <Calendar size={14} />} 
                                    {task.due_date ? new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No due date'}
                                    {isOverdue && <span style={{ marginLeft: '4px' }}>Overdue!</span>}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {showModal && ReactDOM.createPortal(
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }} style={{ zIndex: 9999 }}>
          <div className="modal-window glass" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Create Task</h3>
              <button type="button" className="modal-close-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateTask}>
              {formError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <div className="form-group-modal">
                <label>Task Title</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Design UI"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </div>

              <div className="form-group-modal">
                <label>Description</label>
                <textarea
                  className="modal-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="Describe the task details..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                />
              </div>

              <div className="form-group-modal">
                <label>Assignee</label>
                <select
                  className="modal-input"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                >
                  <option value="">Select Assignee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group-modal">
                <label>Column Status</label>
                <select
                  className="modal-input"
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value)}
                >
                  <option value="todo">To Do</option>
                  <option value="inprogress">In Progress</option>
                  <option value="review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="form-group-modal">
                <label>Link to Project/SOP (Optional)</label>
                <select
                  className="modal-input"
                  value={taskProject}
                  onChange={(e) => setTaskProject(e.target.value)}
                >
                  <option value="">No Project</option>
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>{proj.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group-modal">
                <label>Due Date</label>
                <input
                  type="date"
                  className="modal-input"
                  min={new Date().toISOString().split('T')[0]}
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ margin: 0 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Create Task</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

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
              <table className="custom-table" style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Task</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Employee(s)</th>
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
                      return <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No missed deadlines recorded! 🎉</td></tr>;
                    }
                    
                    return missedTasks.map(task => (
                      <tr key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontWeight: 500 }}>{task.title}</td>
                        <td style={{ padding: '12px' }}>
                          {task.task_assignees && task.task_assignees.length > 0 
                            ? task.task_assignees.map(ta => ta.employees.name).join(', ') 
                            : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Unassigned</span>}
                        </td>
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

