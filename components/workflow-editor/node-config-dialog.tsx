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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowNodeData, WorkflowNodeType } from './workflow-node';
import { InlineFormBuilder, FormField } from '@/components/inline-form-builder';

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  department_id: string;
}

interface NodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeData: WorkflowNodeData | null;
  onSave: (data: WorkflowNodeData) => void;
  departments: Department[];
  roles: Role[];
}

export function NodeConfigDialog({
  open,
  onOpenChange,
  nodeData,
  onSave,
  departments,
  roles,
}: NodeConfigDialogProps) {
  const [label, setLabel] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedApproverRole, setSelectedApproverRole] = useState('');
  const [requiredApprovals, setRequiredApprovals] = useState('1');
  const [selectedFormTemplate, setSelectedFormTemplate] = useState('');
  const [allowAttachments, setAllowAttachments] = useState(false);
  const [conditionType, setConditionType] = useState<'approval_decision' | 'form_value' | 'custom'>('approval_decision');
  const [allowFeedback, setAllowFeedback] = useState(true);
  const [allowSendBack, setAllowSendBack] = useState(true);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isDraftForm, setIsDraftForm] = useState(false);

  useEffect(() => {
    if (nodeData) {
      setLabel(nodeData.label);
      setSelectedDepartment(nodeData.config?.departmentId || '');
      setSelectedRole(nodeData.config?.roleId || '');
      setSelectedApproverRole(nodeData.config?.approverRoleId || '');
      setRequiredApprovals(String(nodeData.config?.requiredApprovals || 1));
      setSelectedFormTemplate(nodeData.config?.formTemplateId || '');
      setAllowAttachments(nodeData.config?.allowAttachments || false);
      setConditionType(nodeData.config?.conditionType || 'approval_decision');
      setAllowFeedback(nodeData.config?.allowFeedback !== undefined ? nodeData.config.allowFeedback : true);
      setAllowSendBack(nodeData.config?.allowSendBack !== undefined ? nodeData.config.allowSendBack : true);
      setFormFields(nodeData.config?.formFields || []);
      setFormName(nodeData.config?.formName || '');
      setFormDescription(nodeData.config?.formDescription || '');
      setIsDraftForm(nodeData.config?.isDraftForm || false);
    }
  }, [nodeData]);

  const handleSave = () => {
    if (!nodeData) return;

    const config: WorkflowNodeData['config'] = {};

    if (nodeData.type === 'department' && selectedDepartment) {
      const dept = departments.find((d) => d.id === selectedDepartment);
      config.departmentId = selectedDepartment;
      config.departmentName = dept?.name;
    }

    if (nodeData.type === 'role' && selectedRole) {
      const role = roles.find((r) => r.id === selectedRole);
      config.roleId = selectedRole;
      config.roleName = role?.name;
    }

    if (nodeData.type === 'approval') {
      if (selectedApproverRole) {
        const role = roles.find((r) => r.id === selectedApproverRole);
        config.approverRoleId = selectedApproverRole;
        config.approverRoleName = role?.name;
      }
      config.requiredApprovals = parseInt(requiredApprovals) || 1;
      config.allowFeedback = allowFeedback;
      config.allowSendBack = allowSendBack;
    }

    if (nodeData.type === 'form') {
      config.formFields = formFields;
      config.formName = formName;
      config.formDescription = formDescription;
      config.isDraftForm = isDraftForm;
    }

    if (nodeData.type === 'conditional') {
      config.conditionType = conditionType;
    }

    onSave({
      ...nodeData,
      label,
      config,
    });

    onOpenChange(false);
  };

  if (!nodeData) return null;

  const filteredRoles = selectedDepartment && selectedDepartment !== "all"
    ? roles.filter((r) => r.department_id === selectedDepartment)
    : roles;

  // Debug logging
  console.log('NodeConfigDialog - departments:', departments.length, departments);
  console.log('NodeConfigDialog - roles:', roles.length, roles);
  console.log('NodeConfigDialog - nodeData:', nodeData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {nodeData.type} Node</DialogTitle>
          <DialogDescription>
            Set up the properties for this workflow node
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter node label"
            />
          </div>

          {/* Department Selection */}
          {nodeData.type === 'department' && (
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Role Selection */}
          {nodeData.type === 'role' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dept-filter">Department (optional filter)</Label>
                <Select value={selectedDepartment || "all"} onValueChange={(value) => setSelectedDepartment(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Approval Configuration */}
          {nodeData.type === 'approval' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="approver">Approver Role *</Label>
                <Select value={selectedApproverRole} onValueChange={setSelectedApproverRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="required-approvals">Required Approvals</Label>
                <Input
                  id="required-approvals"
                  type="number"
                  min="1"
                  value={requiredApprovals}
                  onChange={(e) => setRequiredApprovals(e.target.value)}
                />
              </div>
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allow-feedback"
                    checked={allowFeedback}
                    onCheckedChange={(checked) => setAllowFeedback(checked as boolean)}
                  />
                  <Label htmlFor="allow-feedback" className="text-sm font-normal cursor-pointer">
                    Allow approvers to provide feedback
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allow-send-back"
                    checked={allowSendBack}
                    onCheckedChange={(checked) => setAllowSendBack(checked as boolean)}
                  />
                  <Label htmlFor="allow-send-back" className="text-sm font-normal cursor-pointer">
                    Allow approvers to send back for revisions
                  </Label>
                </div>
              </div>
            </>
          )}

          {/* Form Configuration */}
          {nodeData.type === 'form' && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="fields">Form Fields</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="form-name">Form Name</Label>
                  <Input
                    id="form-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Client Briefing Form"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-description">Description (optional)</Label>
                  <Input
                    id="form-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe the purpose of this form"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="is-draft"
                    checked={isDraftForm}
                    onCheckedChange={(checked) => setIsDraftForm(checked as boolean)}
                  />
                  <Label htmlFor="is-draft" className="text-sm font-normal cursor-pointer">
                    Save as draft (form not active)
                  </Label>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> Forms are scoped to this workflow node. Use them to collect data from
                    departments or send briefings between teams.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="fields" className="mt-4 max-h-[400px] overflow-y-auto">
                <InlineFormBuilder
                  fields={formFields}
                  onChange={setFormFields}
                />
              </TabsContent>
            </Tabs>
          )}

          {/* Conditional Configuration */}
          {nodeData.type === 'conditional' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="condition-type">Condition Type</Label>
                <Select value={conditionType} onValueChange={(value: any) => setConditionType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approval_decision">Approval Decision (Approved/Rejected/Needs Changes)</SelectItem>
                    <SelectItem value="form_value">Form Field Value</SelectItem>
                    <SelectItem value="custom">Custom Condition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Important:</strong> Conditional nodes evaluate the OUTPUT of a previous node (e.g., an approval decision or form submission). Place this node AFTER the node whose output you want to evaluate, not before.
                </p>
                <p className="text-xs text-amber-800 mt-2">
                  Example flow: Approval → Conditional → Route A or Route B
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!label}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
