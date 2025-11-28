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
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Moon,
  Sun,
  Radio,
  Newspaper,
  Download,
  BookOpen,
  Menu,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "기사 수집", href: "/scrape", icon: Download },
  { name: "기사 관리", href: "/articles", icon: BookOpen },
  { name: "정책 매거진", href: "/publish", icon: Newspaper },
];

export default function Header() {
  const pathname = usePathname();
  const { setTheme } = useTheme();

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            <div className="hidden sm:block">
              <div className="font-bold text-base leading-tight">
                주파수 정책
              </div>
              <div className="text-xs text-muted-foreground">
                AI 모니터링
              </div>
            </div>
          </Link>

          {/* Center: Navigation (Desktop) */}
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <NavigationMenuItem key={item.name}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "flex-row items-center gap-2",
                          active && "bg-accent text-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right: Theme toggle & Mobile menu */}
          <div className="flex items-center gap-1">
            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
                  <Monitor className="mr-2 h-4 w-4" />
                  시스템
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">메뉴</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer",
                          active && "bg-accent"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
