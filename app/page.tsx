import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, BookOpen, Languages, Send, ArrowRight, Radio, Waves, Globe, BarChart3, Sparkles } from "lucide-react";

const workflows = [
  {
    step: 1,
    icon: Download,
    title: "스크래핑",
    description: "Excel 파일 업로드 및 Firecrawl API로 기사 수집",
    href: "/scrape",
    variant: "default" as const,
    features: ["Excel 업로드", "첨부파일 자동 다운로드", "실시간 진행 상황"],
  },
  {
    step: 2,
    icon: BookOpen,
    title: "기사 관리",
    description: "수집된 기사 조회, 필터링 및 관리",
    href: "/articles",
    variant: "outline" as const,
    features: ["고급 필터", "날짜 범위 검색", "기사 편집"],
  },
  {
    step: 3,
    icon: Languages,
    title: "번역",
    description: "GPT-4o를 사용한 영한 번역",
    href: "/translate",
    variant: "outline" as const,
    features: ["일괄 번역", "실시간 진행 상황", "품질 검사"],
  },
  {
    step: 4,
    icon: Send,
    title: "발행",
    description: "HTML 매거진 생성 및 이메일 발송",
    href: "/publish",
    variant: "outline" as const,
    features: ["드래그 앤 드롭 정렬", "HTML 미리보기", "이메일 배포"],
  },
];

export default function Home() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-6">
          {/* Logo - Multiple icons representing radio waves, global reach, and data */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative">
              <Radio className="h-14 w-14 text-primary" />
              <Waves className="h-6 w-6 text-primary/60 absolute -bottom-1 -right-1" />
            </div>
            <Separator orientation="vertical" className="h-12" />
            <Globe className="h-12 w-12 text-primary/80" />
            <Separator orientation="vertical" className="h-12" />
            <BarChart3 className="h-12 w-12 text-primary/80" />
          </div>

          {/* Main Title */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              주파수 정책 모니터링 시스템
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              주요국 전파 정책 데이터 AI 기반 수집·번역·시각화
              <br />
              <span className="text-base">실시간 주파수 동향 모니터링</span>
            </p>
          </div>

          {/* Technology Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              AI 번역
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Globe className="h-3 w-3" />
              다국어 지원
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <BarChart3 className="h-3 w-3" />
              데이터 시각화
            </Badge>
          </div>

          {/* Tech Stack */}
          <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
            <span>Next.js 15</span>
            <span>•</span>
            <span>FastAPI</span>
            <span>•</span>
            <span>OpenAI GPT-4o</span>
            <span>•</span>
            <span>Firecrawl</span>
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
                    <Badge variant="outline">단계 {workflow.step}</Badge>
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
                      {workflow.title} 시작
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center space-y-4 pt-8 border-t">
          <div className="pt-8 space-y-2">
            <p className="text-sm font-medium">백엔드 API</p>
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
                실행 중
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              FastAPI + Firecrawl + OpenAI GPT-4o + SQLite
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
