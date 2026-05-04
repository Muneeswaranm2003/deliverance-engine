import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "manager" | "user";

export const useUserRoles = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["user_roles", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.role as AppRole);
    },
  });

  const roles = query.data ?? [];
  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const canManageDeliverability = isAdmin || isManager;

  return {
    roles,
    isAdmin,
    isManager,
    canManageDeliverability,
    isLoading: query.isLoading,
  };
};