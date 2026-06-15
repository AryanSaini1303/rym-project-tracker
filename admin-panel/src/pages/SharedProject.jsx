import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Check, Circle, AlertCircle, Loader2, Zap } from 'lucide-react';
import { supabaseAdmin } from '../lib/supabaseClient';
import './Projects.css';

const SharedProject = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjectData = async () => {
    // Fetch project
    const { data: projData, error: projError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projError || !projData) {
      setIsLoading(false);
      return;
    }

    // Fetch tasks with assignees and employees
    const { data: tasksData } = await supabaseAdmin
      .from('tasks')
      .select(`
        *,
        task_assignees (
          status,
          employees (
            id,
            name
          )
        )
      `)
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    // Calculate overall progress using task counting
    let totalTasks = tasksData ? tasksData.length : 0;
    let completedTasks = 0;
    
    if (tasksData) {
      tasksData.forEach(t => {
        let isTaskDone = false;
        if (t.task_assignees && t.task_assignees.length > 0) {
          isTaskDone = t.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
        } else {
          isTaskDone = (t.status === 'done' || t.status === 'completed');
        }
        if (isTaskDone) completedTasks += 1;
      });
    }

    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    setProject({
      ...projData,
      tasks: tasksData || [],
      totalTasks,
      completedTasks,
      progress
    });
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProjectData();

    // Listen for realtime updates from both the tasks and task_assignees tables
    const tasksSubscription = supabaseAdmin
      .channel('public:shared_tasks_and_assignees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        fetchProjectData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, (payload) => {
        fetchProjectData();
      })
      .subscribe();

    return () => {
      supabaseAdmin.removeChannel(tasksSubscription);
    };
  }, [id]);

  const getProgressColor = (progress) => {
    if (progress === 100) return 'var(--success)';
    if (progress >= 50) return 'var(--primary)';
    if (progress > 0) return 'var(--warning)';
    return 'rgba(255,255,255,0.1)';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#05070c', color: 'var(--text-secondary)' }}>
        <Loader2 className="spinner" size={40} />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#05070c', color: 'var(--danger)' }}>
        Project not found or you don't have access.
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#05070c' }}>
      {/* Top Branding Bar */}
      <div style={{ padding: '2rem 4rem 0', maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img 
            src="/logo.png" 
            alt="RYM Grenergy" 
            style={{ maxHeight: '45px', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={28} color="var(--primary)" />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--primary)', letterSpacing: '0.02em' }}>RYM</span>
              <span style={{ fontWeight: 600, fontSize: '0.65rem', color: '#ffffff', letterSpacing: '0.14em' }}>GRENERGY</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem 4rem 3rem' }}>
        <div style={{ paddingBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.75rem', color: '#fff' }}>{project.title}</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className={`status-badge ${project.progress === 100 ? 'completed' : project.progress > 0 ? 'inprogress' : 'pending'}`}>
                {project.progress === 100 ? 'Completed' : project.progress > 0 ? 'In Progress' : 'Not Started'}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {project.completedTasks} / {project.totalTasks} Tasks Completed
              </span>
            </div>
          </div>
        </div>
        
        <div>
          {project.description && (
            <div className="project-description-full" style={{ marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Project Details</h4>
              <p style={{ lineHeight: '1.6' }}>{project.description}</p>
            </div>
          )}

          {/* Line of Progress Graph */}
          <div className="line-of-progress-container glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Project Completion Timeline</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>{project.progress}%</span>
            </div>
            <div className="progress-bar-bg" style={{ height: '12px', borderRadius: '10px' }}>
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${project.progress}%`,
                  backgroundColor: getProgressColor(project.progress),
                  height: '100%',
                  borderRadius: '10px',
                  transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              ></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>Start</span>
              <span>{project.completedTasks} / {project.totalTasks} Tasks</span>
              <span>Goal</span>
            </div>
          </div>

          <div className="task-board-section" style={{ marginTop: '2.5rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0' }}>Task Board</h3>

            {project.tasks && project.tasks.length > 0 ? (
              <div className="task-list-full">
                {project.tasks.map((task) => {
                  
                  // Helper to calculate the overall task status based on individuals
                  const getCalculatedStatus = () => {
                    if (!task.task_assignees || task.task_assignees.length === 0) return task.status ? task.status.replace('-', '') : 'todo';
                    const allDone = task.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
                    const allTodo = task.task_assignees.every(ta => !ta.status || ta.status === 'todo');
                    if (allDone) return 'done';
                    if (allTodo) return 'todo';
                    if (task.task_assignees.some(ta => ta.status === 'review' || ta.status === 'in-review')) return 'review';
                    return 'inprogress';
                  };
                  
                  const calculatedStatus = getCalculatedStatus();

                  return (
                  <div key={task.id} className="task-row-full" style={{ cursor: 'default' }}>
                    <div className="task-row-status" style={{ cursor: 'default' }}>
                      <div className="custom-status-dropdown-container">
                        <div className={`status-icon-btn ${calculatedStatus}`} style={{ cursor: 'default' }}>
                          {calculatedStatus === 'done' || calculatedStatus === 'completed' ? <Check size={14} /> :
                           calculatedStatus === 'inprogress' ? <div className="half-circle"></div> :
                           calculatedStatus === 'review' ? <AlertCircle size={14} /> : 
                           <Circle size={14} />}
                        </div>
                      </div>
                    </div>
                    
                    <div className="task-row-content">
                      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className={`task-title ${calculatedStatus === 'done' ? 'task-done-strike' : ''}`}>
                          {task.title}
                        </span>
                        
                        <div className="task-row-actions">
                          {task.due_date && (
                            <span className="task-due-date">
                              <Clock size={12} /> {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                          
                          <div className="assignee-dropdown-container">
                            {task.task_assignees && task.task_assignees.length > 0 ? (
                              <div className="assignees-stack-badge" style={{ cursor: 'default' }}>
                                <div className="avatars-stack" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                                  {task.task_assignees.map((ta) => {
                                    const normalizedStatus = ta.status ? ta.status.replace('-', '') : 'todo';
                                    const percent = normalizedStatus === 'done' || normalizedStatus === 'completed' ? 100 : normalizedStatus === 'review' ? 75 : normalizedStatus === 'inprogress' ? 50 : 0;
                                    const color = normalizedStatus === 'done' || normalizedStatus === 'completed' ? 'var(--success)' : normalizedStatus === 'review' ? 'var(--warning)' : normalizedStatus === 'inprogress' ? '#3182ce' : 'var(--text-secondary)';
                                    return (
                                      <div key={ta.employees.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '6px', gap: '8px', minWidth: '130px' }}>
                                        <div className="assignee-avatar" style={{ width: '18px', height: '18px', fontSize: '0.6rem', border: 'none' }}>
                                          {ta.employees.name.charAt(0)}
                                        </div>
                                        <span style={{ fontSize: '0.7rem', width: '40px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ta.employees.name.split(' ')[0]}</span>
                                        
                                        {/* Individual Line Graph Progress Bar */}
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'all 0.5s ease' }}></div>
                                          </div>
                                          <span style={{ fontSize: '0.6rem', color: color, fontWeight: 600, width: '22px', textAlign: 'right' }}>{percent}%</span>
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
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-tasks-list">
                <p>No tasks added to this project yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedProject;
