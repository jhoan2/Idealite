"use client";

import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Trash,
  StickyNote,
  PanelTop,
  FolderPlus,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import type { TreeFolder, TreeTag } from "~/server/queries/usersTags";
import { v4 as uuidv4 } from "uuid";
import { deleteTag } from "~/server/actions/usersTags";
import { createPage, movePage } from "~/server/actions/page";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { movePagesBetweenTags } from "~/server/actions/usersTags";
import { updateTagCollapsed } from "~/server/actions/usersTags";
import { usePathname, useRouter } from "next/navigation";
import { createTab } from "~/server/actions/tabs";
import { MoveToDialog } from "./MoveToDialog";
import {
  updateFolderCollapsed,
  createFolder,
} from "~/server/actions/usersFolders";
import { FolderComponent } from "./Folder";
import { PageComponent } from "./Page";

interface TreeProps {
  data: TreeTag[];
}

const getCurrentTagNode = (
  tags: TreeTag[],
  targetId: string,
): TreeTag | null => {
  for (const tag of tags) {
    if (tag.id === targetId) return tag;
    if (tag.children) {
      const found = getCurrentTagNode(tag.children, targetId);
      if (found) return found;
    }
  }
  return null;
};

const createUntitledPage = (node: TreeTag, allTags: TreeTag[]) => {
  // Get all untitled pages
  const untitledPages = node.pages.filter((page) =>
    page.title.toLowerCase().startsWith("untitled"),
  );

  // Create new page title using array length
  const newTitle =
    untitledPages.length === 0
      ? "untitled"
      : `untitled ${untitledPages.length}`;

  // Get tag hierarchy
  const getTagHierarchy = (currentNode: TreeTag): string[] => {
    const hierarchy: string[] = [currentNode.id];

    const findParent = (tags: TreeTag[], targetId: string): TreeTag | null => {
      for (const tag of tags) {
        if (tag.children?.some((child: TreeTag) => child.id === targetId)) {
          return tag;
        }
        if (tag.children) {
          const found = findParent(tag.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    let parentTag = findParent(allTags, currentNode.id);
    while (parentTag) {
      hierarchy.unshift(parentTag.id);
      parentTag = findParent(allTags, parentTag.id);
    }
    return hierarchy;
  };

  return {
    id: uuidv4(),
    title: newTitle,
    tag_id: node.id,
    hierarchy: getTagHierarchy(node),
    folder_id: null,
  };
};

const TreeNode: React.FC<{
  node: TreeTag;
  level: number;
  allTags: TreeTag[];
  userId: string;
}> = ({ node, level, allTags, userId }) => {
  const hasChildren = node.children && node.children.length > 0;
  const hasPages = node.pages && node.pages.length > 0;
  const hasFolders = node.folders && node.folders.length > 0;
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedPage, setSelectedPage] = useState<{
    id: string;
    title: string;
    folder_id: string | null;
    primary_tag_id: string | null;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(!node.is_collapsed);
  const router = useRouter();

  const pathname = usePathname();
  const currentPageId = pathname?.split("/workspace/")?.[1]?.split("?")?.[0];
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(
      node.folders?.filter((f) => !f.is_collapsed).map((f) => f.id) ?? [],
    ),
  );
  const handleItemClick = async (
    e: React.MouseEvent,
    pageId: string,
    title: string,
  ) => {
    e.preventDefault();

    try {
      // Create new tab
      const newTab = await createTab({
        title,
        path: pageId,
      });

      if (!newTab.success) {
        throw new Error("Failed to create tab");
      }

      // Navigate to the content with type parameter
      router.push(`/workspace/${pageId}?tabId=${newTab.id}`);
    } catch (error) {
      console.error("Error creating tab:", error);
      toast.error("Failed to open item");
    }
  };

  const getTagHierarchy = (
    currentNode: TreeTag,
    allTags: TreeTag[],
  ): string[] => {
    //TODO: There is another function like this in createUntitledPage
    const hierarchy: string[] = [currentNode.id];

    const findParent = (tags: TreeTag[], targetId: string): TreeTag | null => {
      for (const tag of tags) {
        if (tag.children?.some((child: TreeTag) => child.id === targetId)) {
          return tag;
        }
        if (tag.children) {
          const found = findParent(tag.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    let parentTag = findParent(allTags, currentNode.id);
    while (parentTag) {
      hierarchy.unshift(parentTag.id);
      parentTag = findParent(allTags, parentTag.id);
    }

    return hierarchy;
  };

  const handleCreatePage = async (type: "page" | "canvas") => {
    try {
      setIsLoading(true);
      const pageInput = createUntitledPage(node, allTags);
      const result = await createPage(pageInput, type);

      if (!result.success) {
        throw new Error("Failed to create page");
      }
    } catch (error) {
      console.error("Error creating page:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createUntitledPageInFolder = (folder: TreeFolder, tagId: string) => {
    // Get all untitled pages in the folder
    const untitledPages = folder.pages.filter((page: { title: string }) =>
      page.title.toLowerCase().startsWith("untitled"),
    );

    // Create new page title using array length
    const newTitle =
      untitledPages.length === 0
        ? "untitled"
        : `untitled ${untitledPages.length}`;

    const currentTag = getCurrentTagNode(allTags, tagId);
    if (!currentTag) {
      throw new Error("Tag not found");
    }

    return {
      id: uuidv4(),
      title: newTitle,
      tag_id: tagId,
      folder_id: folder.id,
      hierarchy: getTagHierarchy(currentTag, allTags),
    };
  };

  const calculateOrphanedPages = (tag: TreeTag): number => {
    let count = tag.pages.length;
    if (tag.children) {
      for (const child of tag.children) {
        count += calculateOrphanedPages(child);
      }
    }
    return count;
  };

  const handleDeleteTag = async () => {
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    try {
      const result = await deleteTag({ id: node.id });
      if (!result.success) {
        toast.error("Failed to delete tag");
        return;
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.error("Failed to delete tag");
    } finally {
      setShowDeleteAlert(false);
    }
  };

  const handleToggleExpand = async () => {
    if (!hasChildren && !hasPages && !hasFolders) return;

    const newIsExpanded = !isExpanded;
    setIsExpanded(newIsExpanded);

    try {
      const result = await updateTagCollapsed({
        tagId: node.id,
        isCollapsed: !newIsExpanded,
      });

      if (!result.success) {
        toast.error("Failed to update tag state");
        setIsExpanded(!newIsExpanded);
      }
    } catch (error) {
      console.error("Error updating tag state:", error);
      toast.error("Failed to update tag state");
      setIsExpanded(!newIsExpanded);
    }
  };

  const handleFolderToggle = async (folderId: string) => {
    const newExpandedState = !expandedFolders.has(folderId);

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (newExpandedState) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }
      return next;
    });

    try {
      const result = await updateFolderCollapsed({
        folderId,
        isCollapsed: !newExpandedState,
      });

      if (!result.success) {
        toast.error("Failed to update folder state");
        // Revert the state
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          if (!newExpandedState) {
            next.add(folderId);
          } else {
            next.delete(folderId);
          }
          return next;
        });
      }
    } catch (error) {
      console.error("Error updating folder state:", error);
      toast.error("Failed to update folder state");
    }
  };

  const handleCreateFolder = async () => {
    try {
      setIsLoading(true);
      const result = await createFolder({
        tagId: node.id,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create folder");
        return;
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Failed to create folder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePageInFolder = async (
    folder: TreeFolder,
    type: "page" | "canvas",
  ) => {
    try {
      setIsLoading(true);
      const pageInput = createUntitledPageInFolder(folder, node.id);
      const result = await createPage(pageInput, type);

      if (!result.success) {
        throw new Error("Failed to create page");
      }

      // Optionally expand the folder if it's not already expanded
      if (!expandedFolders.has(folder.id)) {
        handleFolderToggle(folder.id);
      }
    } catch (error) {
      console.error("Error creating page:", error);
      toast.error("Failed to create page");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubfolder = async (parentFolder: TreeFolder) => {
    try {
      setIsLoading(true);
      const result = await createFolder({
        tagId: node.id,
        parentFolderId: parentFolder.id,
      });

      console.log(result);

      if (!result.success) {
        toast.error(result.error || "Failed to create folder");
        return;
      }

      // Expand the parent folder if it's not already expanded
      if (!expandedFolders.has(parentFolder.id)) {
        handleFolderToggle(parentFolder.id);
      }
    } catch (error) {
      console.error("Error creating subfolder:", error);
      toast.error("Failed to create folder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMovePage = async (destinationId: string) => {
    if (!selectedPage) return;

    setIsLoading(true);
    try {
      const result = await movePage({
        pageId: selectedPage.id,
        destinationId: destinationId,
      });

      if (!result.success) {
        throw new Error(
          "error" in result ? result.error : "Failed to move page",
        );
      }

      setSelectedPage(null);
      setShowMoveDialog(false);
    } catch (error) {
      console.error("Error moving page:", error);
      // Handle both Error objects and string errors
      const errorMessage =
        error instanceof Error ? error.message : "Failed to move page";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {node.pages.length === 0
                ? "Are you sure you want to delete this tag?"
                : `This will archive ${calculateOrphanedPages(node)} page${
                    calculateOrphanedPages(node) === 1 ? "" : "s"
                  }.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MoveToDialog
        open={showMoveDialog}
        onOpenChange={(isOpen: boolean) => {
          setShowMoveDialog(isOpen);
          if (!isOpen) {
            setSelectedPage(null);
          }
        }}
        tags={allTags}
        currentTagId={node.id}
        currentFolderId={selectedPage?.folder_id ?? null}
        primaryTagId={selectedPage?.primary_tag_id ?? null}
        onMove={handleMovePage}
        isLoading={isLoading}
      />
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="select-none">
            <div
              className={`flex cursor-pointer items-center py-1 transition-colors duration-150 ease-in-out hover:bg-gray-50 dark:hover:bg-gray-700`}
              style={{ paddingLeft: `${level * 16}px` }}
              onClick={handleToggleExpand}
            >
              {
                <button
                  className="mr-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  )}
                </button>
              }
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {node.name}
              </span>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="ml-2">
                {hasPages &&
                  node.pages.map((page) => (
                    <PageComponent
                      key={page.id}
                      page={{
                        id: page.id,
                        title: page.title,
                        folder_id: page.folder_id,
                        primary_tag_id: page.primary_tag_id,
                      }}
                      level={level}
                      currentPageId={currentPageId}
                      onMovePageClick={(pageId, title) => {
                        setSelectedPage({
                          id: pageId,
                          title,
                          folder_id: page.folder_id,
                          primary_tag_id: page.primary_tag_id,
                        });
                        setShowMoveDialog(true);
                      }}
                      handleItemClick={handleItemClick}
                    />
                  ))}
                {/* First render folders */}
                {hasFolders &&
                  node.folders.map((folder) => (
                    <FolderComponent
                      key={folder.id}
                      folder={folder}
                      level={level}
                      parentTagId={node.id}
                      expandedFolders={expandedFolders}
                      handleFolderToggle={handleFolderToggle}
                      handleItemClick={handleItemClick}
                      currentPageId={currentPageId}
                      onMovePageClick={(pageId, title) => {
                        setSelectedPage({
                          id: pageId,
                          title,
                          folder_id: folder.id,
                          primary_tag_id: node.id,
                        });
                        setShowMoveDialog(true);
                      }}
                      onCreatePageInFolder={handleCreatePageInFolder}
                      onCreateSubfolder={handleCreateSubfolder}
                      isLoading={isLoading}
                    />
                  ))}

                {/* Finally render child tags */}
                {hasChildren &&
                  node.children.map((child) => (
                    <TreeNode
                      key={child.id}
                      node={child}
                      level={level + 1}
                      allTags={allTags}
                      userId={userId}
                    />
                  ))}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        {/* Context menu for tags */}
        <ContextMenuContent className="w-64">
          <ContextMenuItem
            onSelect={() => handleCreatePage("page")}
            disabled={isLoading}
            className={isLoading ? "cursor-not-allowed opacity-50" : ""}
          >
            <StickyNote className="mr-2 h-4 w-4" />
            <span>{isLoading ? "Creating..." : "Create  page"}</span>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => handleCreatePage("canvas")}
            disabled={isLoading}
            className={isLoading ? "cursor-not-allowed opacity-50" : ""}
          >
            <PanelTop className="mr-2 h-4 w-4" />
            <span>{isLoading ? "Creating..." : "Create canvas"}</span>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => handleCreateFolder()}
            disabled={isLoading}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            <span>Create folder</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleDeleteTag} className="text-red-600">
            <Trash className="mr-2 h-4 w-4" />
            <span>Delete tag</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
};

const MinimalistTree: React.FC<TreeProps & { userId: string }> = ({
  data,
  userId,
}) => {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="custom-scrollbar h-screen overflow-y-auto p-4">
        {data.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            allTags={data}
            userId={userId}
          />
        ))}
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.7);
        }
        @media (prefers-color-scheme: dark) {
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(156, 163, 175, 0.3);
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(156, 163, 175, 0.5);
          }
        }
      `}</style>
    </div>
  );
};

export default function TagTreeNav({
  userTagTree,
  userId,
}: {
  userTagTree: TreeTag[];
  userId: string;
}) {
  return (
    <div className="flex h-screen">
      <div className="w-64 overflow-hidden border-r">
        <MinimalistTree data={userTagTree} userId={userId} />
      </div>
    </div>
  );
}
