'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  BookOpen,
  Newspaper,
  ArrowRight,
  Radio,
  Globe,
  Sparkles,
  FileText,
  Languages,
  Search,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

const workflows = [
  {
    step: 1,
    icon: Download,
    title: "기사 수집",
    description: "정부기관 웹사이트에서 자동으로 기사 수집",
    href: "/scrape",
    features: [
      { icon: Globe, text: "FCC / Ofcom / Soumu" },
      { icon: Languages, text: "자동 번역 (GPT-4o)" },
      { icon: FileText, text: "첨부파일 다운로드" },
    ],
  },
  {
    step: 2,
    icon: BookOpen,
    title: "기사 관리",
    description: "수집된 기사 조회 및 관리",
    href: "/articles",
    features: [
      { icon: Globe, text: "국가별 필터링" },
      { icon: FileText, text: "날짜 범위 검색" },
      { icon: CheckCircle2, text: "기사 상세보기" },
    ],
  },
  {
    step: 3,
    icon: Newspaper,
    title: "정책 매거진",
    description: "수집된 기사 검색 및 아카이브 열람",
    href: "/publish",
    features: [
      { icon: Search, text: "키워드 검색" },
      { icon: Globe, text: "국가별 필터링" },
      { icon: FileText, text: "기사 상세보기" },
    ],
  },
];

const sources = [
  { name: "FCC", country: "US" },
  { name: "Ofcom", country: "UK" },
  { name: "Soumu", country: "JP" },
];

export default function Home() {
  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="space-y-12">
        {/* Hero Section with Radio Wave Background */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-b from-muted/50 to-background">
          {/* Animated Radio Waves Background */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Radio wave circles */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full border border-primary/20"
                  style={{
                    width: `${i * 120}px`,
                    height: `${i * 120}px`,
                    left: `${-i * 60}px`,
                    top: `${-i * 60}px`,
                    animation: `pulse-wave ${2 + i * 0.5}s ease-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />

          {/* Content */}
          <div className="relative z-10 text-center py-16 px-6 space-y-8">
            {/* Logo with pulse effect */}
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="relative p-5 rounded-full bg-background border-2 border-primary/30 shadow-lg">
                  <Radio className="h-10 w-10 text-primary" />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                주파수 정책
                <span className="block text-primary mt-1">AI 모니터링</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                주요국 전파 정책 데이터를 AI 기반으로 수집, 번역, 발행하는 자동화 시스템
              </p>
            </div>

            {/* Source Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {sources.map((source) => (
                <Badge
                  key={source.name}
                  variant="outline"
                  className="px-4 py-1.5 bg-background/80 backdrop-blur-sm"
                >
                  <span className="font-semibold">{source.name}</span>
                  <Separator orientation="vertical" className="mx-2 h-3" />
                  <span className="text-muted-foreground">{source.country}</span>
                </Badge>
              ))}
            </div>

            {/* Tech Stack */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                GPT-4o
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span>Next.js 15</span>
              <span className="text-muted-foreground/50">|</span>
              <span>FastAPI</span>
              <span className="text-muted-foreground/50">|</span>
              <span>Firecrawl</span>
            </div>
          </div>
        </div>

        {/* Workflow Cards - Muted Colors */}
        <div className="grid gap-6 md:grid-cols-3">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Card
                key={workflow.step}
                className="group relative transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card/50 backdrop-blur-sm"
              >
                {/* Step indicator */}
                <div className="absolute top-4 right-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                    {workflow.step}
                  </span>
                </div>

                <CardHeader className="pb-4">
                  <div className="inline-flex p-3 rounded-xl bg-muted w-fit">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <CardTitle className="text-lg mt-4">{workflow.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {workflow.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-4">
                  <ul className="space-y-2">
                    {workflow.features.map((feature) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <li key={feature.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FeatureIcon className="h-3.5 w-3.5" />
                          <span>{feature.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Link href={workflow.href} className="w-full">
                    <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      시작하기
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-8 border-t">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Backend API</span>
              <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-800">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Running
              </Badge>
            </div>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-xs hover:text-primary transition-colors"
            >
              localhost:8000/docs
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* CSS for radio wave animation */}
      <style jsx>{`
        @keyframes pulse-wave {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
