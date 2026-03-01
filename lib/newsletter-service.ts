import { createClientSupabase } from '@/lib/supabase';
import { logger } from '@/lib/debug-logger';


export type Newsletter = {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  published_at: string | null;
  user_profiles?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
};

export type NewsletterInput = {
  title: string;
  content: string;
};

export const newsletterService = {
  /**
   * Get all published newsletters (for display on welcome page)
   */
  async getPublishedNewsletters(): Promise<Newsletter[]> {
    const supabase = createClientSupabase();

    // Optimized: Limit to 20 most recent newsletters
    const { data, error } = await supabase
      .from('newsletters')
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(20);

    if (error) {
      logger.error('Error fetching newsletters', {}, error as Error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get all newsletters for a user (for management)
   */
  async getUserNewsletters(): Promise<Newsletter[]> {
    const supabase = createClientSupabase();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to view newsletters');
    }

    const { data, error } = await supabase
      .from('newsletters')
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .eq('created_by', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching user newsletters', {}, error as Error);
      throw error;
    }

    return data || [];
  },

  /**
   * Create a new newsletter
   */
  async createNewsletter(input: NewsletterInput): Promise<Newsletter> {
    const supabase = createClientSupabase();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to create a newsletter');
    }

    // First, test if the table exists by trying to select from it
    const { error: tableError } = await supabase
      .from('newsletters')
      .select('id')
      .limit(1);

    if (tableError) {
      logger.error('Newsletters table error', {}, tableError as Error);
      throw new Error('Newsletters table not accessible. Please run the create-newsletters.sql script first.');
    }

    const { data, error } = await supabase
      .from('newsletters')
      .insert({
        title: input.title,
        content: input.content,
        created_by: session.user.id,
        is_published: true, // Auto-publish newsletters
        published_at: new Date().toISOString(),
      })
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      logger.error('Error creating newsletter', {
        code: error.code,
      }, error as unknown as Error);
      throw new Error('Failed to create newsletter');
    }

    return data;
  },

  /**
   * Update a newsletter
   */
  async updateNewsletter(newsletterId: string, input: Partial<NewsletterInput>): Promise<Newsletter> {
    const supabase = createClientSupabase();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to update a newsletter');
    }

    const { data, error } = await supabase
      .from('newsletters')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', newsletterId)
      .eq('created_by', session.user.id)
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      logger.error('Error updating newsletter', {}, error as Error);
      throw error;
    }

    return data;
  },

  /**
   * Publish a newsletter
   */
  async publishNewsletter(newsletterId: string): Promise<Newsletter> {
    const supabase = createClientSupabase();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to publish a newsletter');
    }

    const { data, error } = await supabase
      .from('newsletters')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', newsletterId)
      .eq('created_by', session.user.id)
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      logger.error('Error publishing newsletter', {}, error as Error);
      throw error;
    }

    return data;
  },

  /**
   * Unpublish a newsletter
   */
  async unpublishNewsletter(newsletterId: string): Promise<Newsletter> {
    const supabase = createClientSupabase();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to unpublish a newsletter');
    }

    const { data, error } = await supabase
      .from('newsletters')
      .update({
        is_published: false,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', newsletterId)
      .eq('created_by', session.user.id)
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      logger.error('Error unpublishing newsletter', {}, error as Error);
      throw error;
    }

    return data;
  },

  /**
   * Delete a newsletter
   */
  async deleteNewsletter(newsletterId: string): Promise<void> {
    const supabase = createClientSupabase();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to delete a newsletter');
    }

    const { error } = await supabase
      .from('newsletters')
      .delete()
      .eq('id', newsletterId)
      .eq('created_by', session.user.id);

    if (error) {
      logger.error('Error deleting newsletter', {}, error as Error);
      throw error;
    }
  }
};
