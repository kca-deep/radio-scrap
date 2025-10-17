import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Languages, Send, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Radio Policy Magazine
          </h1>
          <p className="text-xl text-muted-foreground">
            Automated web scraping, translation, and magazine generation system
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <FileText className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>1. Scrape</CardTitle>
              <CardDescription>
                Upload URLs and scrape articles with Firecrawl API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/scrape">
                <Button className="w-full">
                  Start Scraping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <FileText className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>2. Articles</CardTitle>
              <CardDescription>
                View and manage scraped articles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/articles">
                <Button variant="outline" className="w-full">
                  View Articles
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow opacity-50">
            <CardHeader>
              <Languages className="h-8 w-8 mb-2 text-muted-foreground" />
              <CardTitle>3. Translate</CardTitle>
              <CardDescription>
                Translate articles to Korean with GPT-4o
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow opacity-50">
            <CardHeader>
              <Send className="h-8 w-8 mb-2 text-muted-foreground" />
              <CardTitle>4. Publish</CardTitle>
              <CardDescription>
                Generate HTML magazine and send via email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-y-4 pt-8">
          <p className="text-sm text-muted-foreground">
            Backend API running at{" "}
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline"
            >
              http://localhost:8000
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
