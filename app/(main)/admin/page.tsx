'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Workflow,
  UserCheck,
  ArrowRight,
  Shield,
  Crown,
  Clock,
  Database,
  Activity
} from 'lucide-react';
import Link from 'next/link';

export default function AdminHubPage() {
  const userManagementFeatures = [
    {
      title: 'Role Management',
      description: 'Manage organizational roles, permissions, and hierarchies. Assign users to roles and define reporting structures.',
      icon: Shield,
      href: '/admin/roles',
      color: 'text-red-600 bg-red-50',
      borderColor: 'border-red-200',
      features: [
        'Role hierarchy & org chart',
        'Permission management',
        'User role assignments',
        'Department-based roles',
      ],
    },
    {
      title: 'Superadmin Setup',
      description: 'Configure superadmin access and platform-wide settings. Manage system administrators and global permissions.',
      icon: Crown,
      href: '/admin/superadmin-setup',
      color: 'text-amber-600 bg-amber-50',
      borderColor: 'border-amber-200',
      features: [
        'Superadmin configuration',
        'System-level access',
        'Global settings',
        'Platform administration',
      ],
    },
    {
      title: 'Time Tracking Admin',
      description: 'Administrative oversight of time tracking data, approvals, and reporting across the organization.',
      icon: Clock,
      href: '/admin/time-tracking',
      color: 'text-cyan-600 bg-cyan-50',
      borderColor: 'border-cyan-200',
      features: [
        'Time entry oversight',
        'Approval workflows',
        'Reporting & analytics',
        'Policy management',
      ],
    },
  ];

  const workflowClientFeatures = [
    {
      title: 'Workflow Management',
      description: 'Create and manage workflow templates with visual node-based workflows. Define handoff paths and track project progression.',
      icon: Workflow,
      href: '/admin/workflows',
      color: 'text-blue-600 bg-blue-50',
      borderColor: 'border-blue-200',
      features: [
        'Visual workflow builder',
        'Department & role nodes',
        'Client approval nodes',
        'Conditional branching',
      ],
    },
    {
      title: 'Client Portal',
      description: 'Manage client invitations, access, and feedback. Enable clients to view projects, provide feedback, and approve workflow steps.',
      icon: UserCheck,
      href: '/admin/client-portal',
      color: 'text-purple-600 bg-purple-50',
      borderColor: 'border-purple-200',
      features: [
        'Secure client invitations',
        'Project visibility controls',
        'Client approval workflows',
        'Satisfaction ratings & feedback',
      ],
    },
  ];

  const systemSettingsFeatures = [
    {
      title: 'Database Management',
      description: 'Direct database access and management tools for advanced administration and troubleshooting.',
      icon: Database,
      href: '/admin/database',
      color: 'text-slate-600 bg-slate-50',
      borderColor: 'border-slate-200',
      features: [
        'Database queries',
        'Schema management',
        'Data operations',
        'System diagnostics',
      ],
    },
    {
      title: 'RBAC Diagnostics',
      description: 'Diagnose and troubleshoot role-based access control issues. View permission assignments and access patterns.',
      icon: Activity,
      href: '/admin/rbac-diagnostics',
      color: 'text-pink-600 bg-pink-50',
      borderColor: 'border-pink-200',
      features: [
        'Permission diagnostics',
        'Access troubleshooting',
        'Role analysis',
        'Security auditing',
      ],
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Manage platform settings, users, workflows, and operations
        </p>
      </div>

      {/* User Management */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">User Management</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {userManagementFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className={`hover:shadow-lg transition-shadow ${feature.borderColor}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${feature.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Link href={feature.href}>
                      <Button variant="ghost" size="sm">
                        Open
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Workflow & Client Management */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Workflow & Client Management</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workflowClientFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className={`hover:shadow-lg transition-shadow ${feature.borderColor}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${feature.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Link href={feature.href}>
                      <Button variant="ghost" size="sm">
                        Open
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* System Settings */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">System Settings</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {systemSettingsFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className={`hover:shadow-lg transition-shadow ${feature.borderColor}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${feature.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Link href={feature.href}>
                      <Button variant="ghost" size="sm">
                        Open
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
