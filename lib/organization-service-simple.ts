// Simple organization service to fix the server error
import { OrganizationStructure } from './organization-types';

export const organizationService = {
  async getOrganizationStructure(): Promise<OrganizationStructure | null> {
    console.log('Using simple organization service...');
    
    // Return minimal mock data for testing
    const mockData: OrganizationStructure = {
      departments: [
        {
          id: '1',
          name: 'IT Department',
          description: 'Information Technology',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Marketing',
          description: 'Marketing and Communications',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      roles: [
        {
          id: '1',
          name: 'Superadmin',
          description: 'System administrator',
          department_id: '1',
          hierarchy_level: 1000,
          is_system_role: true,
          permissions: {
            manage_users: { enabled: true } as Record<string, unknown>,
            manage_roles: { enabled: true } as Record<string, unknown>,
            manage_departments: { enabled: true } as Record<string, unknown>,
            manage_projects: { enabled: true } as Record<string, unknown>,
            manage_tasks: { enabled: true } as Record<string, unknown>,
            manage_milestones: { enabled: true } as Record<string, unknown>,
            manage_accounts: { enabled: true } as Record<string, unknown>,
            manage_permissions: { enabled: true } as Record<string, unknown>,
            view_analytics: { enabled: true } as Record<string, unknown>,
            view_reports: { enabled: true } as Record<string, unknown>,
            create_projects: { enabled: true } as Record<string, unknown>,
            edit_projects: { enabled: true } as Record<string, unknown>,
            delete_projects: { enabled: true } as Record<string, unknown>,
            assign_tasks: { enabled: true } as Record<string, unknown>,
            view_all_projects: { enabled: true } as Record<string, unknown>
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Developer',
          description: 'Software developer',
          department_id: '1',
          hierarchy_level: 100,
          is_system_role: false,
          permissions: {
            manage_users: { enabled: false } as Record<string, unknown>,
            manage_roles: { enabled: false } as Record<string, unknown>,
            manage_departments: { enabled: false } as Record<string, unknown>,
            manage_projects: { enabled: false } as Record<string, unknown>,
            manage_tasks: { enabled: true } as Record<string, unknown>,
            manage_milestones: { enabled: false } as Record<string, unknown>,
            manage_accounts: { enabled: false } as Record<string, unknown>,
            manage_permissions: { enabled: false } as Record<string, unknown>,
            view_analytics: { enabled: false } as Record<string, unknown>,
            view_reports: { enabled: true } as Record<string, unknown>,
            create_projects: { enabled: false } as Record<string, unknown>,
            edit_projects: { enabled: false } as Record<string, unknown>,
            delete_projects: { enabled: false } as Record<string, unknown>,
            assign_tasks: { enabled: false } as Record<string, unknown>,
            view_all_projects: { enabled: false } as Record<string, unknown>
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'Marketing Manager',
          description: 'Marketing department manager',
          department_id: '2',
          hierarchy_level: 200,
          is_system_role: false,
          permissions: {
            manage_users: { enabled: false } as Record<string, unknown>,
            manage_roles: { enabled: false } as Record<string, unknown>,
            manage_departments: { enabled: false } as Record<string, unknown>,
            manage_projects: { enabled: true } as Record<string, unknown>,
            manage_tasks: { enabled: true } as Record<string, unknown>,
            manage_milestones: { enabled: true } as Record<string, unknown>,
            manage_accounts: { enabled: false } as Record<string, unknown>,
            manage_permissions: { enabled: false } as Record<string, unknown>,
            view_analytics: { enabled: true } as Record<string, unknown>,
            view_reports: { enabled: true } as Record<string, unknown>,
            create_projects: { enabled: true } as Record<string, unknown>,
            edit_projects: { enabled: true } as Record<string, unknown>,
            delete_projects: { enabled: false } as Record<string, unknown>,
            assign_tasks: { enabled: true } as Record<string, unknown>,
            view_all_projects: { enabled: false } as Record<string, unknown>
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ],
      users: [
        {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
          image: null,
          bio: null,
          skills: null,
          workload_sentiment: 'comfortable',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_roles: [{ role_id: '1' }]
        }
      ],
      hierarchy: [
        {
          id: '1',
          name: 'Superadmin',
          department_name: 'IT Department',
          hierarchy_level: 1000,
          is_system_role: true,
          user_count: 1,
          children: [
            {
              id: '2',
              name: 'Developer',
              department_name: 'IT Department',
              hierarchy_level: 100,
              is_system_role: false,
              user_count: 0,
              children: []
            }
          ]
        },
        {
          id: '3',
          name: 'Marketing Manager',
          department_name: 'Marketing',
          hierarchy_level: 200,
          is_system_role: false,
          user_count: 0,
          children: []
        }
      ],
      total_departments: 2,
      total_roles: 3,
      total_users: 1
    };

    console.log('Simple organization structure returned', mockData);
    return mockData;
  },

  async getHierarchyView(): Promise<{ nodes: Record<string, unknown>[] } | null> {
    console.log('Getting hierarchy view from simple service...');
    const data = await this.getOrganizationStructure();
    if (data) {
      return { nodes: data.hierarchy as unknown as Record<string, unknown>[] };
    }
    return null;
  }
};
