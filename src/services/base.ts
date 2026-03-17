import { supabase } from "@/lib/supabase";

/**
 * Base service providing common CRUD operations for any Supabase table.
 * Extend this for table-specific queries.
 *
 * @example
 * const productService = new BaseService<Producto>("productos");
 * const all = await productService.getAll();
 * const one = await productService.getById("uuid");
 */
export class BaseService<T extends { id: string }> {
  constructor(protected table: string) {}

  async getAll(options?: {
    orderBy?: string;
    ascending?: boolean;
    filters?: Record<string, unknown>;
    limit?: number;
  }): Promise<T[]> {
    let query = supabase.from(this.table).select("*");

    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== null && value !== "") {
          query = query.eq(key, value);
        }
      }
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as T[]) || [];
  }

  async getById(id: string): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as T;
  }

  async create(item: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(this.table)
      .insert(item)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(this.table)
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.table).delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async upsert(item: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(this.table)
      .upsert(item)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    let query = supabase.from(this.table).select("*", { count: "exact", head: true });
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== "") {
          query = query.eq(key, value);
        }
      }
    }
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}
