import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  BookIcon,
  LinkIcon,
  MicroscopeIcon,
  CalendarIcon,
  UserIcon,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";

export interface InfoCardProps {
  type: string;
  title: string;
  image: string;
  description: string;
  url: string;
  date_published: Date | null;
  author: string | null;
  resourceId: string;
  pageId: string;
  onDelete: (resourceId: string, pageId: string) => void;
}

export function InfoCard({
  type,
  title,
  image,
  description,
  url,
  date_published,
  author,
  resourceId,
  pageId,
  onDelete,
}: InfoCardProps) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            {type === "url" ? (
              <LinkIcon className="h-5 w-5 text-primary" />
            ) : type === "book" ? (
              <BookIcon className="h-5 w-5 text-primary" />
            ) : type === "research-paper" ? (
              <MicroscopeIcon className="h-5 w-5 text-primary" />
            ) : (
              <LinkIcon className="h-5 w-5 text-primary" />
            )}
            <span className="text-sm text-muted-foreground">{type}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(resourceId, pageId)}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-[160px_1fr] gap-4">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative h-[90px] w-[160px] overflow-hidden rounded-md"
        >
          <img
            src={image}
            alt={title}
            className="transition-all duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 transition-all duration-300 group-hover:bg-black/10" />
        </a>
        <div className="space-y-2">
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>

          <div className="mt-4 flex flex-wrap gap-4">
            {author && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <UserIcon className="h-4 w-4" />
                <span>{author}</span>
              </div>
            )}
            {date_published && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  {new Date(date_published).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default InfoCard;
