import { describe, it, expect } from 'vitest';
import { Permission, PermissionDefinitions } from '@/lib/permissions';

describe('Permission enum', () => {
  it('has unique values for all permissions', () => {
    const values = Object.values(Permission);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });

  it('uses snake_case for all permission values', () => {
    for (const value of Object.values(Permission)) {
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('has a definition for every permission', () => {
    for (const permission of Object.values(Permission)) {
      expect(PermissionDefinitions[permission]).toBeDefined();
      expect(PermissionDefinitions[permission].name).toBeTruthy();
      expect(PermissionDefinitions[permission].description).toBeTruthy();
      expect(PermissionDefinitions[permission].category).toBeTruthy();
    }
  });

  it('marks override permissions with _ALL_ pattern', () => {
    const overridePermissions = Object.values(Permission).filter(
      (p) => p.includes('_all_')
    );
    // Every _ALL_ permission should be marked as an override in definitions
    for (const perm of overridePermissions) {
      expect(PermissionDefinitions[perm].isOverride).toBe(true);
    }
  });
});

describe('Permission categories', () => {
  it('covers all expected categories', () => {
    const categories = new Set(
      Object.values(PermissionDefinitions).map((d) => d.category)
    );
    // These are the core categories we expect
    expect(categories.has('Role Management')).toBe(true);
    expect(categories.has('Project Management')).toBe(true);
    expect(categories.has('Account Management')).toBe(true);
  });
});
