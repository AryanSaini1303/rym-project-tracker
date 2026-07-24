import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { Briefcase, Clock, FileText, CheckCircle, Search, Target, Users, X, AlertTriangle, CheckSquare } from 'lucide-react';
import { triggerPushNotification } from '../lib/push';
import './Projects.css';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [employee, setEmployee] = useState(null);
  
  const [selectedProject, setSelectedProject] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({ title: '', description: '', due_date: '', priority: 'Medium' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: empData } = await supabase
      .from('employees')
      .select('id, name')
      .eq('email', user.email)
      .single();

    if (!empData) return;
    setEmployee(empData);

    // 1. Fetch all projects
    const { data: projectsData, error: projError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Fetch all tasks that belong to a project, including assignee names
    const { data: tasksData, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id, 
        project_id, 
        status, 
        title,
        description,
        due_date,
        task_assignees (
          employee_id,
          status
        )
      `)
      .not('project_id', 'is', null);

    if (projError || taskError) {
      setIsLoading(false);
      return;
    }

    // 3. Process the data to calculate progress and filter by employee
    const processedProjects = projectsData.map(proj => {
      const projTasks = (tasksData || []).filter(t => t.project_id === proj.id);
      let totalTasks = projTasks.length;
      let completedTasks = 0;
      
      let hasEmployeeTasks = false;
      let hasPendingTasks = false;
      let allEmployeeTasksCompleted = true;
      let employeeTasks = [];

      projTasks.forEach(t => {
        // Calculate collective completion for overall progress
        let isTaskDone = false;
        if (t.task_assignees && t.task_assignees.length > 0) {
          isTaskDone = t.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
        } else {
          isTaskDone = (t.status === 'done' || t.status === 'completed');
        }
        if (isTaskDone) completedTasks += 1;

        // Determine if this task is assigned to the current employee
        const empAssigneeInfo = t.task_assignees?.find(ta => ta.employee_id === empData.id);
        const isAssignedToEmp = !!empAssigneeInfo;
        
        if (isAssignedToEmp) {
          hasEmployeeTasks = true;
          employeeTasks.push({
            ...t,
            myStatus: empAssigneeInfo.status || 'todo'
          });

          if (empAssigneeInfo.status === 'todo' || empAssigneeInfo.status === 'inprogress' || empAssigneeInfo.status === 'in-progress' || empAssigneeInfo.status === 'review') {
            hasPendingTasks = true;
            allEmployeeTasksCompleted = false;
          }
        }
      });

      const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
      
      const empTotalTasks = employeeTasks.length;
      const empCompletedTasks = employeeTasks.filter(t => t.myStatus === 'done' || t.myStatus === 'completed').length;
      const empProgress = empTotalTasks === 0 ? 0 : Math.round((empCompletedTasks / empTotalTasks) * 100);

      return { 
        ...proj, 
        progress, 
        empProgress,
        totalTasks, 
        completedTasks, 
        empTotalTasks,
        empCompletedTasks,
        hasEmployeeTasks,
        hasPendingTasks,
        allEmployeeTasksCompleted: hasEmployeeTasks && allEmployeeTasksCompleted,
        employeeTasks
      };
    }).filter(p => p.hasEmployeeTasks); // ONLY show projects where they have tasks!

    setProjects(processedProjects);
    setIsLoading(false);
  };

  const getStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': return <span className="status-badge status-completed">Completed</span>;
      case 'on-hold': return <span className="status-badge status-onhold">On Hold</span>;
      case 'active':
      default: return <span className="status-badge status-active">Active</span>;
    }
  };

  const getTaskStatusColor = (status) => {
    switch(status) {
      case 'done':
      case 'completed': return 'var(--success)';
      case 'inprogress':
      case 'in-progress': return 'var(--primary)';
      case 'review': return 'var(--warning)';
      default: return 'var(--text-secondary)';
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskForm.title.trim() || !selectedProject) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (newTaskForm.due_date && newTaskForm.due_date < todayStr) {
      toast.error('Due date cannot be in the past.');
      return;
    }

    setIsSubmittingTask(true);
    
    const taskPayload = {
      title: newTaskForm.title.trim(),
      description: newTaskForm.description.trim() || 'Task added by employee.',
      assignee_id: employee.id, // Primary assignee
      project_id: selectedProject.id,
      status: 'todo',
      due_date: newTaskForm.due_date || null
    };

    const { data: insertedTask, error: taskError } = await supabase
      .from('tasks')
      .insert([taskPayload])
      .select()
      .single();

    if (taskError) {
      toast.error('Error creating task: ' + taskError.message);
      setIsSubmittingTask(false);
      return;
    }

    // Insert into task_assignees
    const { error: assigneeError } = await supabase
      .from('task_assignees')
      .insert([{
        task_id: insertedTask.id,
        employee_id: employee.id,
        status: 'todo'
      }]);

    if (!assigneeError) {
      toast.success('Task created & assigned to you!');
      setShowTaskModal(false);
      setNewTaskForm({ title: '', description: '', due_date: '', priority: 'Medium' });
      fetchData(); // Refresh the list
    } else {
      toast.error('Failed to link task to you.');
    }
    
    setIsSubmittingTask(false);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    let points = 0;
    let completedAt = null;

    if (newStatus === 'done') {
      completedAt = new Date().toISOString();
      const { data: configData } = await supabase
        .from('points_config')
        .select('points_value')
        .eq('rule_key', 'taskDone')
        .single();
      points = configData ? configData.points_value : 15;
    }

    const { error } = await supabase
      .from('task_assignees')
      .update({ status: newStatus })
      .match({ task_id: taskId, employee_id: employee.id });

    if (completedAt) {
      await supabase.from('tasks').update({
        completed_at: completedAt,
        points_awarded: points
      }).eq('id', taskId);
    }

    if (!error) {
      toast.success('Task status updated successfully!');
      
      if (newStatus === 'review' || newStatus === 'done') {
        let taskName = 'A task';
        projects.forEach(p => {
          const t = p.employeeTasks.find(et => et.id === taskId);
          if (t) taskName = t.title;
        });
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
      // Re-fetch everything to update overall progress and statuses correctly
      fetchData();
    } else {
      toast.error('Error updating task status: ' + error.message);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="page-container projects-container">
      <div className="projects-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle" style={{ margin: 0, marginTop: '4px' }}>Projects you are actively involved in.</p>
        </div>
        <div className="header-actions">
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search your projects..." 
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty-state glass">
          <Briefcase size={48} className="empty-icon" />
          <h3>No Projects Found</h3>
          <p>You have not been assigned tasks in any active projects.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map(project => (
            <div key={project.id} className="project-card glass" onClick={() => setSelectedProject(project)}>
              <div className="project-card-header">
                <div>
                  <h3 className="project-title">{project.title}</h3>
                  <div className="project-meta">
                    {getStatusBadge(project.status)}
                    {project.target_date && (
                      <span className="project-date">
                        <Target size={14} />
                        Target: {new Date(project.target_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {/* Smart Notification Icon */}
                <div className="project-status-icon">
                  {project.allEmployeeTasksCompleted ? (
                    <div title="All your tasks are completed!" style={{ color: 'var(--success)', background: 'rgba(52, 211, 153, 0.1)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                      <CheckCircle size={24} />
                    </div>
                  ) : project.hasPendingTasks ? (
                    <div title="You have pending tasks in this project" style={{ color: 'var(--warning)', background: 'rgba(251, 191, 36, 0.1)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                      <AlertTriangle size={24} />
                    </div>
                  ) : null}
                </div>
              </div>
              
              <div className="project-description">
                <p>{project.description || 'No description provided.'}</p>
              </div>

              <div className="project-progress-section">
                <div className="progress-header">
                  <span>Overall Project Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="progress-track" style={{ marginBottom: '1rem' }}>
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${project.progress}%`,
                      backgroundColor: project.progress === 100 ? 'var(--success)' : 'var(--primary)'
                    }}
                  ></div>
                </div>

                <div className="progress-header">
                  <span style={{ color: 'var(--success)' }}>Your Progress</span>
                  <span style={{ color: 'var(--success)' }}>{project.empProgress}%</span>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${project.empProgress}%`,
                      backgroundColor: project.empProgress === 100 ? 'var(--success)' : 'var(--primary)'
                    }}
                  ></div>
                </div>
              </div>

              <div className="project-footer">
                <div className="stat">
                  <CheckSquare size={16} />
                  <span>{project.completedTasks} / {project.totalTasks} Total Tasks</span>
                </div>
                <div className="stat">
                  <Users size={16} />
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{project.employeeTasks.length} Assigned to You</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restricted Project Details Modal */}
      {selectedProject && (
        <div className="modal-overlay">
          <div className="modal-content glass project-modal" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{selectedProject.title}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, marginTop: '5px', fontSize: '0.9rem' }}>
                  {selectedProject.description}
                </p>
              </div>
              <button className="close-btn" onClick={() => setSelectedProject(null)}><X size={24} /></button>
            </div>

            <div className="modal-body" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckSquare size={18} color="var(--primary)"/> My Tasks in this Project
                </h3>
                <button className="btn-primary" onClick={() => setShowTaskModal(true)}>+ Add Task</button>
              </div>

              {selectedProject.employeeTasks.length === 0 ? (
                <div className="empty-state glass" style={{ padding: '2rem' }}>
                  <p>You don't have any tasks assigned here.</p>
                </div>
              ) : (
                <div className="tasks-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {selectedProject.employeeTasks.map(task => (
                    <div key={task.id} className="task-item glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{task.title}</h4>
                        {task.description && (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{task.description}</p>
                        )}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {task.due_date && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={12} /> Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select 
                          className="status-select" 
                          value={task.myStatus}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: getTaskStatusColor(task.myStatus),
                            border: `1px solid ${getTaskStatusColor(task.myStatus)}`,
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="todo" style={{ color: 'var(--text-primary)', background: 'var(--bg-color)' }}>TODO</option>
                          <option value="inprogress" style={{ color: 'var(--text-primary)', background: 'var(--bg-color)' }}>IN PROGRESS</option>
                          <option value="review" style={{ color: 'var(--text-primary)', background: 'var(--bg-color)' }}>REVIEW</option>
                          <option value="done" style={{ color: 'var(--text-primary)', background: 'var(--bg-color)' }}>DONE</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Task to {selectedProject?.title}</h2>
              <button className="close-btn" onClick={() => setShowTaskModal(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="form-group-modal">
                <label>Task Title</label>
                <input
                  type="text"
                  className="modal-input"
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm({...newTaskForm, title: e.target.value})}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group-modal">
                <label>Description</label>
                <textarea
                  className="modal-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={newTaskForm.description}
                  onChange={(e) => setNewTaskForm({...newTaskForm, description: e.target.value})}
                ></textarea>
              </div>
              <div className="form-group-modal">
                <label>Due Date</label>
                <input
                  type="date"
                  className="modal-input"
                  min={new Date().toISOString().split('T')[0]}
                  value={newTaskForm.due_date}
                  onChange={(e) => setNewTaskForm({...newTaskForm, due_date: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmittingTask}>
                  {isSubmittingTask ? 'Creating...' : 'Create & Assign to Me'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
