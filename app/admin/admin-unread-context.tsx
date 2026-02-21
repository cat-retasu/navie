"use client";

import { createContext, useContext } from "react";

type AdminUnreadContextValue = {
  unreadTotal: number;
};

export const AdminUnreadContext = createContext<AdminUnreadContextValue>({
  unreadTotal: 0,
});

export function useAdminUnread() {
  return useContext(AdminUnreadContext);
}
