export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetPage: string;
  targetSelector?: string; // data-tutorial="xxx" attribute to highlight
  requiredAction?: string; // What user must complete
  order: number;
  isRequired: boolean; // Cannot skip required steps
  icon: string; // lucide-react icon name
}

export const SUPERADMIN_TUTORIAL: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Dashboard',
    description:
      "This is your command center. Let's set up your organization step by step. We'll start with departments, then create roles, and finally invite your team.",
    targetPage: '/dashboard',
    order: 0,
    isRequired: true,
    icon: 'LayoutDashboard',
  },
  {
    id: 'create_department',
    title: 'Create Your First Department',
    description:
      'Departments organize your team by function (e.g., Marketing, Design, Engineering). You need at least one department before you can create roles. Click "Create Department" to get started.',
    targetPage: '/departments',
    targetSelector: '[data-tutorial="create-department"]',
    requiredAction: 'create_department',
    order: 1,
    isRequired: true,
    icon: 'Building2',
  },
  {
    id: 'create_role',
    title: 'Create a Role with Permissions',
    description:
      'Roles define what your team members can do. Create a role in your department and configure its permissions. Each role gets specific access to projects, accounts, and features.',
    targetPage: '/admin/roles',
    targetSelector: '[data-tutorial="create-role"]',
    requiredAction: 'create_role',
    order: 2,
    isRequired: true,
    icon: 'Shield',
  },
  {
    id: 'invite_user',
    title: 'Invite Your First Team Member',
    description:
      "Now that you have departments and roles set up, invite someone to your team. They'll receive an email with a link to create their account.",
    targetPage: '/admin',
    targetSelector: '[data-tutorial="invite-user"]',
    requiredAction: 'send_invitation',
    order: 3,
    isRequired: true,
    icon: 'UserPlus',
  },
  {
    id: 'explore_accounts',
    title: 'Create a Client Account',
    description:
      'Accounts represent your clients. Create one to start organizing projects. You can skip this for now and come back later.',
    targetPage: '/accounts',
    targetSelector: '[data-tutorial="create-account"]',
    order: 4,
    isRequired: false,
    icon: 'Users',
  },
  {
    id: 'explore_projects',
    title: 'Create Your First Project',
    description:
      'Projects live under client accounts. Create a project to start tracking work, assigning tasks, and running workflows.',
    targetPage: '/projects',
    targetSelector: '[data-tutorial="create-project"]',
    order: 5,
    isRequired: false,
    icon: 'FolderOpen',
  },
  {
    id: 'complete',
    title: 'Setup Complete!',
    description:
      "Your organization is ready. Your team can now log in with the roles and permissions you've configured. You can always revisit any of these settings from the Admin panel.",
    targetPage: '/dashboard',
    order: 6,
    isRequired: true,
    icon: 'CheckCircle',
  },
];

/**
 * Generate a role-based tutorial for a new (non-superadmin) user.
 * Steps are dynamically selected based on the user's role permissions.
 */
export function generateUserTutorial(permissions: string[]): TutorialStep[] {
  const steps: TutorialStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to MovaLab!',
      description: 'This quick tour will show you the features available to you. Let\'s get you oriented.',
      targetPage: '/welcome',
      order: 0,
      isRequired: true,
      icon: 'Home',
    },
  ];

  let order = 1;

  // Dashboard - almost everyone gets this
  if (permissions.some(p => ['view_projects', 'view_all_projects', 'view_accounts', 'view_all_accounts'].includes(p))) {
    steps.push({
      id: 'dashboard',
      title: 'Your Dashboard',
      description: 'This is your home base. It shows your tasks, time tracking, workflows, and key metrics at a glance.',
      targetPage: '/dashboard',
      order: order++,
      isRequired: true,
      icon: 'LayoutDashboard',
    });
  }

  // Projects
  if (permissions.some(p => ['view_projects', 'view_all_projects', 'manage_projects', 'manage_all_projects'].includes(p))) {
    steps.push({
      id: 'projects',
      title: 'Your Projects',
      description: 'Here you\'ll find all projects you\'re assigned to. You can view tasks, log updates, report issues, and track progress.',
      targetPage: '/projects',
      order: order++,
      isRequired: false,
      icon: 'FolderOpen',
    });
  }

  // Time tracking
  if (permissions.some(p => ['manage_time', 'view_time_entries', 'view_all_time_entries'].includes(p))) {
    steps.push({
      id: 'time_tracking',
      title: 'Time Tracking',
      description: 'Log your work hours here. Use the clock widget in the sidebar to clock in/out, or log time manually on specific tasks.',
      targetPage: '/time-entries',
      order: order++,
      isRequired: false,
      icon: 'Clock',
    });
  }

  // Departments
  if (permissions.some(p => ['view_departments', 'view_all_departments', 'manage_departments'].includes(p))) {
    steps.push({
      id: 'departments',
      title: 'Departments',
      description: 'View your department\'s team, projects, and performance metrics.',
      targetPage: '/departments',
      order: order++,
      isRequired: false,
      icon: 'Building2',
    });
  }

  // Accounts (for managers+)
  if (permissions.some(p => ['view_accounts', 'view_all_accounts', 'manage_accounts'].includes(p))) {
    steps.push({
      id: 'accounts',
      title: 'Client Accounts',
      description: 'Manage client accounts and their associated projects. Each account represents a client relationship.',
      targetPage: '/accounts',
      order: order++,
      isRequired: false,
      icon: 'Users',
    });
  }

  // Workflows
  if (permissions.some(p => ['execute_workflows', 'manage_workflows'].includes(p))) {
    steps.push({
      id: 'workflows',
      title: 'Workflows',
      description: 'Projects follow defined workflows. When it\'s your turn, you\'ll see a "Send to Next Step" button to hand off work.',
      targetPage: '/projects',
      order: order++,
      isRequired: false,
      icon: 'GitBranch',
    });
  }

  // Capacity (for team leads)
  if (permissions.some(p => ['view_team_capacity', 'view_all_capacity', 'edit_own_availability'].includes(p))) {
    steps.push({
      id: 'capacity',
      title: 'Capacity & Availability',
      description: 'Set your weekly availability and view team capacity utilization.',
      targetPage: '/capacity',
      order: order++,
      isRequired: false,
      icon: 'BarChart3',
    });
  }

  // Analytics (for leadership)
  if (permissions.some(p => ['view_all_analytics', 'view_all_department_analytics', 'view_all_account_analytics'].includes(p))) {
    steps.push({
      id: 'analytics',
      title: 'Analytics Dashboard',
      description: 'Comprehensive insights across your organization — projects, team performance, capacity, and workflows.',
      targetPage: '/analytics',
      order: order++,
      isRequired: false,
      icon: 'BarChart3',
    });
  }

  // Admin - role management
  if (permissions.some(p => ['manage_user_roles', 'manage_users'].includes(p))) {
    steps.push({
      id: 'admin_roles',
      title: 'Role Management',
      description: 'As an admin, you can create roles, set permissions, and manage the organizational hierarchy.',
      targetPage: '/admin/roles',
      order: order++,
      isRequired: false,
      icon: 'Shield',
    });
  }

  // Admin - workflow management
  if (permissions.includes('manage_workflows')) {
    steps.push({
      id: 'admin_workflows',
      title: 'Workflow Builder',
      description: 'Design workflow templates that define how projects move through your organization.',
      targetPage: '/admin/workflows',
      order: order++,
      isRequired: false,
      icon: 'GitBranch',
    });
  }

  // Profile - everyone
  steps.push({
    id: 'profile',
    title: 'Your Profile',
    description: 'Update your name, bio, and skills. This is visible to your team.',
    targetPage: '/profile',
    order: order++,
    isRequired: false,
    icon: 'User',
  });

  // Complete - always last
  steps.push({
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'You\'re ready to start working. If you need help, check with your team administrator.',
    targetPage: '/dashboard',
    order: order,
    isRequired: true,
    icon: 'CheckCircle',
  });

  return steps;
}
