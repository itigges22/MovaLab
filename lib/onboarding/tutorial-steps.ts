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
 * Will be implemented in Task 7.
 */
export function generateUserTutorial(_permissions: string[]): TutorialStep[] {
  return [];
}
