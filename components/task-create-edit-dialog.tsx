'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { taskServiceDB, Task, CreateTaskData, UpdateTaskData } from '@/lib/task-service-db';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface TaskCreateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: Task | null; // If provided, edit mode; otherwise, create mode
  onTaskSaved: () => void;
}

export default function TaskCreateEditDialog({
  open,
  onOpenChange,
  projectId,
  task,
  onTaskSaved,
}: TaskCreateEditDialogProps) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [canAssignTask, setCanAssignTask] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'backlog' as 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    start_date: '',
    due_date: '',
    estimated_hours: '',
    assigned_to: '',
  });

  const isEditMode = !!task;

  // Load users and check permissions
  useEffect(() => {
    if (open && userProfile) {
      loadUsers();
      checkPermissions();
    }
  }, [open, userProfile]);

  // Populate form when task changes (edit mode)
  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name || '',
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        start_date: task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '',
        due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
        estimated_hours: task.estimated_hours?.toString() || '',
        assigned_to: task.assigned_to || '',
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        description: '',
        status: 'backlog',
        priority: 'medium',
        start_date: '',
        due_date: '',
        estimated_hours: '',
        assigned_to: '',
      });
    }
  }, [task, open]);

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function checkPermissions() {
    if (!userProfile) return;
    const canAssign = await hasPermission(userProfile, Permission.ASSIGN_TASK);
    setCanAssignTask(canAssign);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Task name is required');
      return;
    }

    if (!userProfile?.id) {
      alert('You must be logged in to create/edit tasks');
      return;
    }

    setLoading(true);

    try {
      if (isEditMode && task) {
        // Update existing task
        const updateData: UpdateTaskData = {
          id: task.id,
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          priority: formData.priority,
          start_date: formData.start_date || null,
          due_date: formData.due_date || null,
          estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
          assigned_to: formData.assigned_to || null,
        };

        const updatedTask = await taskServiceDB.updateTask(updateData);
        if (updatedTask) {
          onTaskSaved();
          onOpenChange(false);
        } else {
          alert('Failed to update task');
        }
      } else {
        // Create new task
        const createData: CreateTaskData = {
          name: formData.name,
          description: formData.description || null,
          project_id: projectId,
          status: formData.status,
          priority: formData.priority,
          start_date: formData.start_date || null,
          due_date: formData.due_date || null,
          estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
          created_by: userProfile.id,
          assigned_to: formData.assigned_to || null,
        };

        const newTask = await taskServiceDB.createTask(createData);
        if (newTask) {
          onTaskSaved();
          onOpenChange(false);
        } else {
          alert('Failed to create task');
        }
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('An error occurred while saving the task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update task information' : 'Add a new task to this project'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Task Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter task name"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Estimated Hours */}
          <div className="space-y-2">
            <Label htmlFor="estimated_hours">Estimated Hours</Label>
            <Input
              id="estimated_hours"
              type="number"
              min="0"
              step="0.5"
              value={formData.estimated_hours}
              onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
              placeholder="0"
            />
          </div>

          {/* Assigned To */}
          {canAssignTask && (
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Assigned users will get access to this project and its account
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Task' : 'Create Task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

