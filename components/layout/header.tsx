"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, Radio, FileText, Languages, Send, Download, BookOpen, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "스크랩", href: "/scrape", icon: Download, description: "URL 업로드 및 스크랩" },
  { name: "기사 관리", href: "/articles", icon: BookOpen, description: "기사 관리" },
  { name: "번역", href: "/translate", icon: Languages, description: "한글 번역" },
  { name: "발행", href: "/publish", icon: Send, description: "매거진 생성" },
];

export default function Header() {
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4">
        {/* Left: Logo */}
        <div className="flex items-center flex-1">
          <Link href="/" className="flex items-center space-x-2">
            <Radio className="h-6 w-6" />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="font-bold text-base bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                주파수 정책
              </span>
              <span className="text-xs text-muted-foreground">AI 모니터링</span>
            </div>
          </Link>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "transition-colors",
                    isActive && "bg-secondary"
                  )}
                  title={item.description}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right: Theme toggle & Mobile menu */}
        <div className="flex items-center justify-end gap-2 flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">테마 전환</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" />
                  라이트
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" />
                  다크
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Radio className="mr-2 h-4 w-4" />
                  시스템
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">메뉴</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {navigation.map((item) => {
                  const Icon = item.icon;

                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link href={item.href} className="flex items-center cursor-pointer">
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </div>
    </header>
  );
}
