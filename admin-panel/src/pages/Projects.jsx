import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Briefcase, Plus, Search, Calendar, CheckCircle2, Circle, AlertCircle, Loader2, UploadCloud, Edit2, Trash2, X, ChevronDown, Check, UserPlus, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabaseAdmin } from '../lib/supabaseClient';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth/mammoth.browser';
import './Projects.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const Projects = () => {
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [projectLink, setProjectLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  
  // Quick Task Modal State
  const [quickTaskModal, setQuickTaskModal] = useState({ show: false, projectId: null, projectName: '' });
  const [newTask, setNewTask] = useState({ title: '', assignee: '', dueDate: '' });
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Project Details Modal State
  const [selectedProject, setSelectedProject] = useState(null);
  const [openStatusMenu, setOpenStatusMenu] = useState(null);
  const [openAssigneeMenu, setOpenAssigneeMenu] = useState(null);
  const [editingTask, setEditingTask] = useState(null); // { id, title }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    let extractedText = '';
    const parsingToast = toast.loading("Extracting and analyzing document with AI...");

    try {
      if (file.name.toLowerCase().endsWith('.txt')) {
        extractedText = await file.text();
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extractedText += content.items.map(item => item.str).join(' ') + '\n';
        }
      } else {
        toast.error("Unsupported file format. Please upload .txt, .docx, or .pdf", { id: parsingToast });
        setIsParsing(false);
        return;
      }

      // Step 2: Send extracted text to our secure Vite Proxy for OpenAI processing
      if (!extractedText.trim()) {
        toast.error("Could not extract any text from the document.", { id: parsingToast });
        setIsParsing(false);
        return;
      }

      const aiResponse = await fetch('/api/summarize-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText })
      });

      if (!aiResponse.ok) {
        throw new Error('AI analysis failed. Please check if your API key is correct.');
      }

      const aiData = await aiResponse.json();
      
      let parsedAiContent = aiData;
      // Depending on OpenAI SDK version/return format, the proxy sends back the raw openai JSON
      if (aiData.choices && aiData.choices.length > 0) {
        parsedAiContent = JSON.parse(aiData.choices[0].message.content);
      }

      setNewProject(prev => ({ 
        ...prev, 
        title: parsedAiContent.title || prev.title,
        description: parsedAiContent.description || extractedText.substring(0, 500)
      }));

      toast.success("AI generated title and summary successfully!", { id: parsingToast });
    } catch (error) {
      console.error("Error analyzing file:", error);
      toast.error(error.message || "Failed to analyze document.", { id: parsingToast });
      
      // Fallback: just put the raw text in if AI fails
      if (extractedText) {
         setNewProject(prev => ({ ...prev, description: extractedText.substring(0, 1000) + '...' }));
      }
    }
    setIsParsing(false);
  };

  const handleLinkFetch = async () => {
    if (!projectLink) return;
    setIsParsing(true);
    const parsingToast = toast.loading("Extracting and analyzing link with AI...");

    try {
      const aiResponse = await fetch('/api/summarize-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: projectLink })
      });

      if (!aiResponse.ok) {
        const errData = await aiResponse.json().catch(()=>({}));
        throw new Error(errData.error || 'AI analysis failed. Ensure the link is public.');
      }

      const aiData = await aiResponse.json();
      
      let parsedAiContent = aiData;
      if (aiData.choices && aiData.choices.length > 0) {
        parsedAiContent = JSON.parse(aiData.choices[0].message.content);
      }

      setNewProject(prev => ({ 
        ...prev, 
        title: parsedAiContent.title || prev.title,
        description: parsedAiContent.description || 'Processed from link.'
      }));

      toast.success("AI generated title and summary from link successfully!", { id: parsingToast });
      setProjectLink('');
    } catch (error) {
      console.error("Error analyzing link:", error);
      toast.error(error.message || "Failed to analyze link.", { id: parsingToast });
    }
    setIsParsing(false);
  };

  const fetchProjectsData = async () => {
    setIsLoading(true);
    
    // 1. Fetch all projects
    const { data: projectsData, error: projError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (projError) {
      console.error('Error fetching projects:', projError);
      setIsLoading(false);
      return;
    }

    // 2. Fetch all tasks that belong to a project, including assignee names
    const { data: tasksData, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select(`
        id, 
        project_id, 
        status, 
        title,
        description,
        due_date,
        task_assignees (
          status,
          employees ( id, name )
        )
      `)
      .not('project_id', 'is', null);

    if (taskError) {
      console.error('Error fetching tasks:', taskError);
    }

    // Fetch all employees for quick task assignment
    const { data: empData } = await supabaseAdmin.from('employees').select('id, name').order('name');
    if (empData) setAllEmployees(empData);

    // 3. Process the data to calculate progress and unique employees
    const formattedProjects = projectsData.map(proj => {
      const projTasks = (tasksData || []).filter(t => t.project_id === proj.id);
      let totalTasks = projTasks.length;
      let completedTasks = 0;
      
      projTasks.forEach(t => {
        let isTaskDone = false;
        if (t.task_assignees && t.task_assignees.length > 0) {
          isTaskDone = t.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
        } else {
          isTaskDone = (t.status === 'done' || t.status === 'completed');
        }
        if (isTaskDone) completedTasks += 1;
      });
      
      const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

      // Extract unique employees from all individual assignments
      const employeeMap = new Map();
      projTasks.forEach(t => {
        if (t.task_assignees) {
          t.task_assignees.forEach(ta => {
            if (ta.employees) employeeMap.set(ta.employees.id, ta.employees.name);
          });
        }
      });
      const uniqueEmployees = Array.from(employeeMap.values());

      return {
        ...proj,
        totalTasks,
        completedTasks,
        progress,
        assignedEmployees: uniqueEmployees,
        tasks: projTasks
      };
    });

    setProjects(formattedProjects);
    setIsLoading(false);

    // Auto-open project from dashboard navigation if provided
    if (location.state?.openProjectId) {
      const targetProj = formattedProjects.find(p => p.id === location.state.openProjectId);
      if (targetProj) setSelectedProject(targetProj);
      // Clear state so it doesn't reopen if they close and fetch runs again
      window.history.replaceState({}, document.title);
    }
  };

  // Keep selectedProject in sync with main projects array
  useEffect(() => {
    if (selectedProject) {
      const updatedProject = projects.find(p => p.id === selectedProject.id);
      if (updatedProject) {
        setSelectedProject(updatedProject);
      }
    }
  }, [projects]);

  useEffect(() => {
    fetchProjectsData();

    // Listen for realtime updates from both the tasks and task_assignees tables
    const tasksSubscription = supabaseAdmin
      .channel('public:tasks_and_assignees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        fetchProjectsData(); // Refresh the data instantly
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, (payload) => {
        fetchProjectsData(); // Refresh instantly when individual status changes
      })
      .subscribe();

    return () => {
      supabaseAdmin.removeChannel(tasksSubscription);
    };
  }, []);

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!newProject.title.trim()) return;

    setIsSubmitting(true);
    
    if (editProjectId) {
      const { data, error } = await supabaseAdmin
        .from('projects')
        .update({ 
          title: newProject.title.trim(), 
          description: newProject.description.trim() 
        })
        .eq('id', editProjectId)
        .select();

      if (!error && data) {
        setProjects(projects.map(p => p.id === editProjectId ? { ...p, title: data[0].title, description: data[0].description } : p));
        toast.success("Project updated successfully!");
        closeModal();
      } else {
        toast.error("Failed to update project.");
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from('projects')
        .insert([{ 
          title: newProject.title.trim(), 
          description: newProject.description.trim() 
        }])
        .select();

      if (!error && data) {
        setProjects([{ ...data[0], totalTasks: 0, completedTasks: 0, progress: 0, assignedEmployees: [] }, ...projects]);
        toast.success("Project created successfully!");
        closeModal();
      } else {
        toast.error("Failed to create project.");
      }
    }
    setIsSubmitting(false);
  };

  const openEditModal = (project) => {
    setEditProjectId(project.id);
    setNewProject({ title: project.title, description: project.description || '' });
    setShowModal(true);
  };

  const handleDeleteProject = async (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Are you sure you want to delete this project? Tasks attached to it will not be deleted, but they will be disconnected from the project.</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', transition: 'all 0.2s' }}>Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            const { error } = await supabaseAdmin.from('projects').delete().eq('id', id);
            if (!error) {
              setProjects(projects.filter(p => p.id !== id));
              toast.success("Project deleted successfully.");
            } else {
              toast.error("Failed to delete project: " + error.message);
            }
          }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>Delete</button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditProjectId(null);
    setNewProject({ title: '', description: '' });
  };

  const openQuickTask = (project) => {
    setQuickTaskModal({ show: true, projectId: project.id, projectName: project.title });
    setNewTask({ title: '', assignee: allEmployees.length > 0 ? allEmployees[0].id : '', dueDate: new Date().toISOString().split('T')[0] });
  };

  const closeQuickTask = () => {
    setQuickTaskModal({ show: false, projectId: null, projectName: '' });
    setNewTask({ title: '', assignee: '', dueDate: '' });
  };

  const handleQuickTaskSubmit = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    setIsSubmittingTask(true);
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert([{
        title: newTask.title.trim(),
        description: `Task created for project: ${quickTaskModal.projectName}`,
        status: 'todo',
        assignee_id: newTask.assignee || null,
        due_date: newTask.dueDate || null,
        project_id: quickTaskModal.projectId
      }])
      .select();

    if (!error) {
      // Reload projects to instantly update the task count
      fetchProjectsData();
      toast.success("Task created successfully!");
      closeQuickTask();
    } else {
      toast.error("Failed to create task: " + error.message);
    }
    setIsSubmittingTask(false);
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    setOpenStatusMenu(null);
    const { error } = await supabaseAdmin.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (!error) {
      // Automatically sync the new status to all individual assignees
      await supabaseAdmin.from('task_assignees').update({ status: newStatus }).eq('task_id', taskId);

      // Update local state for immediate feedback
      const updateProjectStats = (p) => {
        const updatedTasks = p.tasks.map(t => {
          if (t.id === taskId) {
            // Update the main task status and all individual assignee statuses locally
            const updatedAssignees = (t.task_assignees || []).map(ta => ({ ...ta, status: newStatus }));
            return { ...t, status: newStatus, task_assignees: updatedAssignees };
          }
          return t;
        });
        
        let totalAssignments = updatedTasks.length;
        let completedAssignments = 0;
        
        updatedTasks.forEach(t => {
          let isTaskDone = false;
          if (t.task_assignees && t.task_assignees.length > 0) {
            isTaskDone = t.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
          } else {
            isTaskDone = (t.status === 'done' || t.status === 'completed');
          }
          if (isTaskDone) completedAssignments += 1;
        });

        const progress = totalAssignments === 0 ? 0 : Math.round((completedAssignments / totalAssignments) * 100);
        return { ...p, tasks: updatedTasks, completedTasks: completedAssignments, totalTasks: totalAssignments, progress };
      };

      setProjects(projects.map(p => p.id === selectedProject?.id ? updateProjectStats(p) : p));
      
      if (selectedProject) {
        setSelectedProject(updateProjectStats(selectedProject));
      }
      fetchProjectsData(); // Refresh background data to update overall progress bar
    } else {
      toast.error('Failed to update status');
    }
  };

  const toggleTaskAssignee = async (taskId, employeeId, employeeName) => {
    const task = projects.flatMap(p => p.tasks).find(t => t.id === taskId);
    if (!task) return;

    const currentAssignees = task.task_assignees || [];
    const isAssigned = currentAssignees.some(ta => ta.employees.id === employeeId);

    if (isAssigned) {
      // Remove assignee
      const { error } = await supabaseAdmin.from('task_assignees').delete().match({ task_id: taskId, employee_id: employeeId });
      if (error) {
        toast.error(`Error removing: ${error.message}`);
        return;
      }
      
      const newAssignees = currentAssignees.filter(ta => ta.employees.id !== employeeId);
      updateLocalTaskAssignees(taskId, newAssignees);
    } else {
      // Add assignee
      const { error } = await supabaseAdmin.from('task_assignees').insert([{ task_id: taskId, employee_id: employeeId }]);
      if (error) {
        toast.error(`Error assigning: ${error.message}`);
        return;
      }
      
      const newAssignees = [...currentAssignees, { employees: { id: employeeId, name: employeeName } }];
      updateLocalTaskAssignees(taskId, newAssignees);
    }
  };

  const updateLocalTaskAssignees = (taskId, newAssignees) => {
    setProjects(projects.map(p => {
      if (p.id === selectedProject?.id) {
        const updatedTasks = p.tasks.map(t => t.id === taskId ? { ...t, task_assignees: newAssignees } : t);
        return { ...p, tasks: updatedTasks };
      }
      return p;
    }));
    if (selectedProject) {
      setSelectedProject({ ...selectedProject, tasks: selectedProject.tasks.map(t => t.id === taskId ? { ...t, task_assignees: newAssignees } : t) });
    }
  };

  const handleSaveTaskTitle = async (taskId) => {
    if (!editingTask || !editingTask.title.trim()) {
      setEditingTask(null);
      return;
    }
    const { error } = await supabaseAdmin.from('tasks').update({ title: editingTask.title.trim() }).eq('id', taskId);
    if (!error) {
      setProjects(projects.map(p => {
        if (p.id === selectedProject?.id) {
          const updatedTasks = p.tasks.map(t => t.id === taskId ? { ...t, title: editingTask.title.trim() } : t);
          return { ...p, tasks: updatedTasks };
        }
        return p;
      }));
      if (selectedProject) {
        setSelectedProject({ ...selectedProject, tasks: selectedProject.tasks.map(t => t.id === taskId ? { ...t, title: editingTask.title.trim() } : t) });
      }
    } else {
      toast.error('Failed to update task title');
    }
    setEditingTask(null);
  };

  const getProgressColor = (progress) => {
    if (progress === 100) return 'var(--success)';
    if (progress >= 60) return '#3182ce'; // Blue
    if (progress >= 30) return 'var(--warning)'; // Yellow
    if (progress > 0) return 'var(--danger)'; // Red
    return 'rgba(255,255,255,0.1)';
  };

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="projects-container">
      <div className="projects-header">
        <div>
          <h1 className="page-title">Projects & SOPs</h1>
          <p className="page-subtitle">Track large-scale goals, standard operating procedures, and overall task progress.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> New Project
        </button>
      </div>

      <div className="search-bar glass">
        <Search size={20} className="search-icon" />
        <input 
          type="text" 
          placeholder="Search projects..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {isLoading ? (
        <div className="loading-state">
          <Loader2 className="spinner" size={32} />
          <p>Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty-state glass">
          <Briefcase size={48} className="empty-icon" />
          <h3>No Projects Found</h3>
          <p>Create your first project to start tracking group tasks and SOPs.</p>
          <button className="btn-primary mt-4" onClick={() => setShowModal(true)}>Create Project</button>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map(project => (
            <div key={project.id} className="project-card glass" onClick={() => setSelectedProject(project)} style={{ cursor: 'pointer' }}>
              <div className="project-card-header" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <h3 style={{ marginRight: '1rem', flex: 1, fontSize: '1.2rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {project.title}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); openEditModal(project); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.color='#fff'} onMouseLeave={(e)=>e.currentTarget.style.color='var(--text-secondary)'} title="Edit Project"><Edit2 size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.color='var(--danger)'} onMouseLeave={(e)=>e.currentTarget.style.color='var(--text-secondary)'} title="Delete Project"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
              
              <p className="project-description">{project.description || 'No description provided.'}</p>
              
              <div className="progress-section" style={{ background: 'transparent', padding: 0, marginBottom: '1.2rem' }}>
                <div className="progress-header" style={{ marginBottom: '0.4rem' }}>
                  <span className="progress-text" style={{ fontSize: '0.8rem' }}>Progress</span>
                  <span className="progress-percentage" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{project.progress}%</span>
                </div>
                <div className="progress-bar-bg" style={{ height: '4px', marginBottom: '0.4rem' }}>
                  <div 
                    className="progress-bar-fill" 
                    style={{ 
                      width: `${project.progress}%`,
                      backgroundColor: getProgressColor(project.progress)
                    }}
                  ></div>
                </div>
                <div className="task-stats" style={{ textAlign: 'left', fontSize: '0.75rem', fontWeight: 500 }}>
                  <span>{project.completedTasks} / {project.totalTasks} Tasks Completed</span>
                </div>
              </div>

              <div className="project-card-footer" style={{ 
                marginTop: 'auto', 
                paddingTop: '1rem', 
                borderTop: '1px solid rgba(255,255,255,0.08)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <span className={`status-badge ${project.progress === 100 ? 'completed' : project.progress > 0 ? 'inprogress' : 'pending'}`}>
                  {project.progress === 100 ? 'Completed' : project.progress > 0 ? 'In Progress' : 'Not Started'}
                </span>
                <button onClick={(e) => { e.stopPropagation(); openQuickTask(project); }} style={{ background: 'rgba(0, 223, 162, 0.1)', border: '1px solid rgba(0, 223, 162, 0.2)', color: 'var(--primary)', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s' }} onMouseEnter={(e)=>{e.currentTarget.style.background='var(--primary)'; e.currentTarget.style.color='#000';}} onMouseLeave={(e)=>{e.currentTarget.style.background='rgba(0, 223, 162, 0.1)'; e.currentTarget.style.color='var(--primary)';}}>
                  <Plus size={14} /> Add Task
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editProjectId ? 'Edit Project' : 'Create New Project'}</h2>
              <button className="btn-close-icon" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSaveProject}>
              <div className="form-group">
                <label>Project Title *</label>
                <input 
                  type="text" 
                  required 
                  value={newProject.title}
                  onChange={(e) => setNewProject({...newProject, title: e.target.value})}
                  placeholder="e.g., Q3 Marketing Campaign"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Upload Document or Paste Link (Auto-fill title & description)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)',
                    border: '1px dashed var(--primary)', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', color: 'var(--text-secondary)'
                  }}>
                    {isParsing ? <Loader2 size={18} className="spinner" /> : <UploadCloud size={18} />}
                    {isParsing ? 'Processing...' : 'Upload .pdf, .docx, .txt'}
                    <input 
                      type="file" 
                      accept=".txt,.pdf,.docx" 
                      onChange={handleFileUpload} 
                      style={{ display: 'none' }}
                      disabled={isParsing}
                    />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '250px' }}>
                    <input 
                      type="url" 
                      placeholder="Or paste a Google Docs / public link" 
                      className="form-input" 
                      style={{ margin: 0, padding: '0.5rem', flex: 1 }}
                      value={projectLink}
                      onChange={(e) => setProjectLink(e.target.value)}
                      disabled={isParsing}
                    />
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={handleLinkFetch} 
                      disabled={!projectLink || isParsing}
                      style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                    >
                      Process Link
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  The AI will automatically extract text from your file or link to write the title and description.
                </p>
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea 
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  placeholder="Brief details about the project..."
                  className="form-input"
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editProjectId ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Task Modal */}
      {quickTaskModal.show && (
        <div className="modal-overlay" onClick={closeQuickTask} style={{ zIndex: 200 }}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Add Task to Project</h2>
              <button className="btn-close-icon" onClick={closeQuickTask}>&times;</button>
            </div>
            <form onSubmit={handleQuickTaskSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ color: 'var(--primary)' }}>Project: {quickTaskModal.projectName}</label>
              </div>
              <div className="form-group">
                <label>Task Title *</label>
                <input 
                  type="text" 
                  required 
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  placeholder="e.g., Finalize presentation"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Assign To</label>
                <select
                  className="form-input"
                  value={newTask.assignee}
                  onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                >
                  <option value="">Select Employee</option>
                  {allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input 
                  type="date" 
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeQuickTask}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmittingTask}>
                  {isSubmittingTask ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Details Full View Modal */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)} style={{ zIndex: 100 }}>
          <div className="modal-content glass project-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{selectedProject.title}</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span className={`status-badge ${selectedProject.progress === 100 ? 'completed' : selectedProject.progress > 0 ? 'inprogress' : 'pending'}`}>
                    {selectedProject.progress === 100 ? 'Completed' : selectedProject.progress > 0 ? 'In Progress' : 'Not Started'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {selectedProject.completedTasks} / {selectedProject.totalTasks} Tasks Completed
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => {
                    const url = `${window.location.origin}/share/projects/${selectedProject.id}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Public link copied to clipboard!');
                  }}
                  title="Copy public share link"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                  Share
                </button>
                <button className="btn-close-icon" onClick={() => setSelectedProject(null)}>&times;</button>
              </div>
            </div>
            
            <div className="project-details-body">
              {selectedProject.description && (
                <div className="project-description-full">
                  <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Project Details</h4>
                  <p>{selectedProject.description}</p>
                </div>
              )}

              {/* Line of Progress Graph */}
              <div className="line-of-progress-container glass">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Project Completion Timeline</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>{selectedProject.progress}%</span>
                </div>
                <div className="progress-bar-bg" style={{ height: '12px', borderRadius: '10px' }}>
                  <div 
                    className="progress-bar-fill" 
                    style={{ 
                      width: `${selectedProject.progress}%`,
                      backgroundColor: getProgressColor(selectedProject.progress),
                      height: '100%',
                      borderRadius: '10px',
                      transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  ></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Start</span>
                  <span>{selectedProject.completedTasks} / {selectedProject.totalTasks} Tasks</span>
                  <span>Goal</span>
                </div>
              </div>

              <div className="task-board-section" style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>Task Board</h3>
                  <button className="btn-primary" onClick={() => openQuickTask(selectedProject)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    <Plus size={14} style={{ marginRight: '0.25rem' }} /> Add Task
                  </button>
                </div>

                {selectedProject.tasks && selectedProject.tasks.length > 0 ? (
                  <div className="task-list-full">
                    {selectedProject.tasks.map((task) => {
                      
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
                      <div key={task.id} className="task-row-full">
                        <div className="task-row-status">
                          <div className="custom-status-dropdown-container">
                            <button 
                              className={`status-icon-btn ${calculatedStatus}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenStatusMenu(openStatusMenu === task.id ? null : task.id); }}
                              title="Change Status"
                            >
                              {calculatedStatus === 'done' || calculatedStatus === 'completed' ? <Check size={14} /> :
                               calculatedStatus === 'inprogress' ? <div className="half-circle"></div> :
                               calculatedStatus === 'review' ? <AlertCircle size={14} /> : 
                               <Circle size={14} />}
                            </button>
                          {openStatusMenu === task.id && (
                            <div className="status-dropdown-menu glass">
                              <div className="status-option todo" onClick={() => updateTaskStatus(task.id, 'todo')}><Circle size={14}/> To Do</div>
                              <div className="status-option inprogress" onClick={() => updateTaskStatus(task.id, 'inprogress')}><div className="half-circle"></div> In Progress</div>
                              <div className="status-option review" onClick={() => updateTaskStatus(task.id, 'review')}><AlertCircle size={14}/> In Review</div>
                              <div className="status-option done" onClick={() => updateTaskStatus(task.id, 'done')}><Check size={14}/> Completed</div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="task-row-content">
                        {editingTask?.id === task.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                            <input 
                              type="text" 
                              value={editingTask.title} 
                              onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                              className="form-input"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveTaskTitle(task.id)}
                            />
                            <button className="btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleSaveTaskTitle(task.id)}>Save</button>
                            <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setEditingTask(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="task-row-inner">
                            <span className={`task-title ${calculatedStatus === 'done' ? 'task-done-strike' : ''}`} onClick={() => setEditingTask({ id: task.id, title: task.title })} style={{ cursor: 'pointer' }} title="Click to edit">
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
                                  <div className="assignees-stack-badge" onClick={() => setOpenAssigneeMenu(openAssigneeMenu === task.id ? null : task.id)}>
                                    <div className="avatars-stack" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                                      {task.task_assignees.map((ta, i) => {
                                        const normalizedStatus = ta.status ? ta.status.replace('-', '') : 'todo';
                                        const percent = normalizedStatus === 'done' || normalizedStatus === 'completed' ? 100 : normalizedStatus === 'review' ? 75 : normalizedStatus === 'inprogress' ? 50 : 0;
                                        const color = normalizedStatus === 'done' || normalizedStatus === 'completed' ? 'var(--success)' : normalizedStatus === 'review' ? 'var(--warning)' : normalizedStatus === 'inprogress' ? '#3182ce' : 'var(--text-secondary)';
                                        return (
                                          <div key={ta.employees.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '3px 7px', borderRadius: '6px', gap: '6px', minWidth: '100px', maxWidth: '150px' }}>
                                            <div className="assignee-avatar" style={{ width: '16px', height: '16px', fontSize: '0.55rem', border: 'none', flexShrink: 0 }}>
                                              {ta.employees.name.charAt(0)}
                                            </div>
                                            <span style={{ fontSize: '0.68rem', maxWidth: '36px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{ta.employees.name.split(' ')[0]}</span>
                                            
                                            {/* Individual Line Graph Progress Bar */}
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                                              <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', minWidth: '20px' }}>
                                                <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'all 0.5s ease' }}></div>
                                              </div>
                                              <span style={{ fontSize: '0.58rem', color: color, fontWeight: 600, width: '22px', textAlign: 'right', flexShrink: 0 }}>{percent}%</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <button className="btn-add-assignee" onClick={() => setOpenAssigneeMenu(openAssigneeMenu === task.id ? null : task.id)}>
                                    <UserPlus size={14} /> Assign
                                  </button>
                                )}
                                
                                {openAssigneeMenu === task.id && (
                                  <div className="assignee-dropdown-menu glass" style={{ width: '250px' }}>
                                    <div className="assignee-options">
                                      {allEmployees.map(emp => {
                                        const assignment = (task.task_assignees || []).find(ta => ta.employees.id === emp.id);
                                        const isAssigned = !!assignment;
                                        return (
                                          <div key={emp.id} className="assignee-option" onClick={() => toggleTaskAssignee(task.id, emp.id, emp.name)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                              <div className="assignee-avatar">{emp.name.charAt(0)}</div> {emp.name}
                                            </div>
                                            {isAssigned && (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {assignment.status === 'done' ? <Check size={14} color="var(--success)" /> :
                                                 assignment.status === 'inprogress' ? <div className="half-circle" style={{ width: '10px', height: '10px' }}></div> :
                                                 assignment.status === 'review' ? <AlertCircle size={14} color="var(--warning)" /> : 
                                                 <Circle size={14} color="var(--text-secondary)" />}
                                                <Check size={14} color="var(--primary)" style={{ marginLeft: '4px' }} />
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
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
      )}
    </div>
  );
};

export default Projects;
