import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { HowlingWolfLoader } from "@/components/HowlingWolfLoader";

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [manualLoading, setManualLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const router = useRouter();
  const startTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubBefore = router.subscribe("onBeforeNavigate", () => {
      startTimeRef.current = Date.now();
      setRouteLoading(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    });

    const unsubResolved = router.subscribe("onResolved", () => {
      const now = Date.now();
      const elapsed = startTimeRef.current ? now - startTimeRef.current : 0;
      const remaining = Math.max(0, 2000 - elapsed);
      
      if (remaining > 0) {
        timeoutRef.current = setTimeout(() => {
          setRouteLoading(false);
        }, remaining);
      } else {
        setRouteLoading(false);
      }
    });

    return () => {
      unsubBefore();
      unsubResolved();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [router]);

  const showLoader = manualLoading || routeLoading;

  return (
    <LoadingContext.Provider value={{ isLoading: showLoader, setLoading: setManualLoading }}>
      {children}
      {showLoader && <HowlingWolfLoader />}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}
