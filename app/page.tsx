import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, BookOpen, Languages, Send, ArrowRight, Radio } from "lucide-react";

const workflows = [
  {
    step: 1,
    icon: Download,
    title: "Scrape",
    description: "Upload Excel file and scrape articles with Firecrawl API",
    href: "/scrape",
    variant: "default" as const,
    features: ["Excel upload", "Auto-download attachments", "Real-time progress"],
  },
  {
    step: 2,
    icon: BookOpen,
    title: "Articles",
    description: "Browse, filter, and manage scraped articles",
    href: "/articles",
    variant: "outline" as const,
    features: ["Advanced filters", "Date range search", "Edit articles"],
  },
  {
    step: 3,
    icon: Languages,
    title: "Translate",
    description: "Translate articles from English to Korean with GPT-4o",
    href: "/translate",
    variant: "outline" as const,
    features: ["Batch translation", "Real-time progress", "Quality check"],
  },
  {
    step: 4,
    icon: Send,
    title: "Publish",
    description: "Generate HTML magazine and send via email",
    href: "/publish",
    variant: "outline" as const,
    features: ["Drag-and-drop ordering", "HTML preview", "Email distribution"],
  },
];

export default function Home() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center mb-6">
            <Radio className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Radio Policy Magazine
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Automated web scraping, translation, and magazine generation system
          </p>
          <div className="flex items-center justify-center gap-2 pt-4">
            <Badge variant="secondary">Next.js 15</Badge>
            <Badge variant="secondary">FastAPI</Badge>
            <Badge variant="secondary">OpenAI GPT-4o</Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Card key={workflow.step} className="hover:shadow-lg transition-all hover:scale-105">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="h-8 w-8 text-primary" />
                    <Badge variant="outline">Step {workflow.step}</Badge>
                  </div>
                  <CardTitle>{workflow.title}</CardTitle>
                  <CardDescription>{workflow.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {workflow.features.map((feature) => (
                      <li key={feature} className="flex items-center">
                        <ArrowRight className="h-3 w-3 mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={workflow.href}>
                    <Button variant={workflow.variant} className="w-full">
                      Go to {workflow.title}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center space-y-4 pt-8 border-t">
          <div className="pt-8 space-y-2">
            <p className="text-sm font-medium">Backend API</p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-primary hover:underline"
              >
                http://localhost:8000/docs
              </a>
              <Badge variant="outline" className="text-green-600">
                Running
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              FastAPI with Firecrawl, OpenAI GPT-4o, and SQLite
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
