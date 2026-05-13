"use client";

import { Bird, PanelLeft } from "lucide-react";
import { useRef, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "@/components/ui/sidebar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Link from "next/link";
import { useKillSwitch } from "./kill-switch-context";

export function AppHeader() {
  const PROFILE_DOUBLE_CLICK_WINDOW_MS = 450;
  const { isMobile, toggleSidebar } = useSidebar();
  const { enabled, setEnabled, pushRestoreStep } = useKillSwitch();
  const userAvatar = PlaceHolderImages.find((img) => img.id === "user-avatar");
  const lastProfileClickAtRef = useRef(0);

  const captureRestoreClick = (event: MouseEvent) => {
    if (!enabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pushRestoreStep("restore-click");
  };

  const captureRestoreDoubleClick = (event: MouseEvent) => {
    if (!enabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pushRestoreStep("restore-double-click");
  };

  const handleProfileClick = (event: MouseEvent) => {
    if (enabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();
    if (now - lastProfileClickAtRef.current <= PROFILE_DOUBLE_CLICK_WINDOW_MS) {
      lastProfileClickAtRef.current = 0;
      setEnabled(true);
      return;
    }

    lastProfileClickAtRef.current = now;
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="md:hidden"
        >
          <PanelLeft className="size-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      )}
      <div className="flex w-full items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
            {/* Using Bird as a placeholder for a more specific logo icon */}
            <Bird className="h-6 w-6 text-primary" onClick={captureRestoreClick} />
            <span className="text-lg" onDoubleClick={captureRestoreDoubleClick}>InvoicePilot</span>
        </Link>

        <Button
          variant="outline"
          size="icon"
          className="overflow-hidden rounded-full select-none"
          onClick={handleProfileClick}
          title="Settings"
          aria-label="Settings"
        >
          <Avatar>
            {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User Avatar" draggable={false} />}
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  );
}
