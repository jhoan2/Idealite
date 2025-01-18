"use client";

import { useEffect, useState } from "react";
import sdk, { FrameNotificationDetails } from "@farcaster/frame-sdk";
import { useSession } from "next-auth/react";
import Image from "next/image";
import SignInWithFarcaster from "./SignInWithFarcaster";
import { Button } from "~/components/ui/button";
import ChannelFrameTags from "./ChannelFrameTags";
import { toast } from "sonner";
import { SelectTag } from "~/server/queries/tag";
import posthog from "posthog-js";

interface ExploreStateProps {
  tag: SelectTag[];
  userTags: SelectTag[];
  userId: string | null;
  isMember: boolean;
}

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type FrameContext = {
  user: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  // @ts-ignore
  location?: FrameLocationContext;
  client: {
    clientFid: number;
    added: boolean;
    safeAreaInsets?: SafeAreaInsets;
    notificationDetails?: FrameNotificationDetails;
  };
};

export default function ChannelHome({
  tag,
  userTags,
  userId,
  isMember,
}: ExploreStateProps) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<FrameContext>();
  const { data: session, status } = useSession();

  const handleJoinChannel = async () => {
    const response = await fetch("/api/channelMembership", {
      method: "POST",
      body: JSON.stringify({ fid: session?.user?.fid }),
    });
    const data = await response.json();
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success("You are now a member of the channel");
    }
  };

  useEffect(() => {
    const load = async () => {
      setContext(await sdk.context);
      sdk.actions.ready();
    };
    if (context) {
      posthog.register({
        fid: context.user?.fid,
        username: context.user?.username,
        displayName: context.user?.displayName,
        authStatus: status,
      });
    }
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
    return () => {
      posthog.unregister("fid");
      posthog.unregister("username");
      posthog.unregister("displayName");
      posthog.unregister("authStatus");
    };
  }, [isSDKLoaded]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <nav className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-2">
            <Image
              src="/icon48.png"
              alt="idealite logo"
              width={32}
              height={32}
            />
            <h1 className="text-xl font-semibold text-amber-400">Idealite</h1>
          </div>
          <div className="flex space-x-2">
            <SignInWithFarcaster status={status} />
            {!isMember && status === "authenticated" && (
              <Button onClick={handleJoinChannel}>Join Channel</Button>
            )}
          </div>
        </div>
      </nav>
      <ChannelFrameTags
        tag={tag}
        userTags={userTags}
        userId={userId}
        status={status}
      />
    </>
  );
}
