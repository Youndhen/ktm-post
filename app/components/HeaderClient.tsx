"use client";

import React from "react";
import { Playfair_Display } from "next/font/google";
import Link from "next/link";
import { House, X, Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Category } from "@/lib/type";
import NepaliDateTime from "./NepaliDateTime";
import Image from "next/image";
import { useMobileMenu } from "./MobileMenuContext"; 

import SearchDropdown from "./SearchDropdown";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

interface HeaderClientProps {
  categories: Category[];
}

export default function HeaderClient({ categories }: HeaderClientProps) {
  const pathname = usePathname() || "";
  const { mobileMenuOpen, setMobileMenuOpen } = useMobileMenu();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300">
      {/* TOP UTILITY & LOGO BAR (Hides on scroll > 80px) */}
      <div
        className={`w-full max-w-[1920px] mx-auto px-mobile-safe relative flex flex-col items-center transition-all duration-300 ${
          scrolled
            ? "max-h-14 opacity-80 py-0.5"
            : "max-h-60 opacity-100 py-1.5 sm:py-2"
        }`}
      >
        {/* Date & Location (Top utility line) - 3-column grid for perfect alignment */}
    {/*
<div className="w-full grid grid-cols-3 items-center border-b border-gray-100 pb-1 mb-1.5 text-xs tracking-wider text-gray-500 uppercase font-medium">
  <span className="hidden sm:block text-left">Kathmandu, Nepal</span>
  <div className="col-span-3 sm:col-span-1 text-center">
    <NepaliDateTime />
  </div>
  <span className="hidden sm:block text-right">English / नेपाली</span>
</div>
*/}

        {/* Logo Masthead */}
        <div className={`flex items-center justify-between w-full px-4 sm:px-6 ${scrolled ? "py-1.5" : "py-3"} relative`}>
          {/* Left: spacer that keeps the logo centred */}
          <div className="w-12 sm:min-w-[140px]" aria-hidden="true" />

          {/* Center: Brand Logo + Nepali Date */}
          <div className="flex flex-col items-center justify-center text-center">
            <Link href="/" className="transition-transform duration-200 hover:scale-[1.01] inline-block">
              <Image
                src="/logo.png"
                width={360}
                height={90}
                alt="KTM Post Logo"
                className={scrolled ? "h-7 sm:h-9 md:h-10 lg:h-11 w-auto object-contain" : "h-9 sm:h-12 md:h-14 lg:h-16 w-auto object-contain"}
                priority
              />
            </Link>
            {!scrolled && (
              <div className="mt-1">
                <NepaliDateTime />
              </div>
            )}
          </div>

          {/* Right: Search button on Desktop & Mobile Menu Hamburger on Mobile */}
          <div className="flex items-center justify-end w-12 sm:min-w-[140px]">
            {/* Desktop search in masthead */}
            <div className="hidden lg:flex items-center">
              <SearchDropdown variant="search" />
            </div>

            {/* Mobile hamburger button */}
            <div className="lg:hidden shrink-0">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-blue-900" />
                ) : (
                  <Menu className="w-6 h-6 text-blue-900" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP STICKY NAVBAR - cleanly centered & responsive */}
      <nav className="hidden lg:block bg-white border-t border-b border-gray-200 shadow-xs">
        <div className="max-w-[1920px] mx-auto flex items-center justify-center px-4 xl:px-8 py-1.5">

          {/* Navigation items - cleanly spaced and centered with smooth scroll */}
          <div className="w-full flex justify-center overflow-x-auto scrollbar-hide py-0.5">
            <ul className="flex items-center gap-1 xl:gap-2.5 2xl:gap-3.5 text-nepal-black font-nepali-serif whitespace-nowrap">
              {categories.map((item, index) => {
                const isHome = item.slug === "/";
                const href = isHome ? "/" : `/${item.slug}`;
                const isActive = isHome
                  ? pathname === "/"
                  : pathname.startsWith(`/${item.slug}`);
                return (
                  <li key={index} className="shrink-0">
                    <Link href={href}>
                      <span
                        className={`inline-block px-1.5 xl:px-2.5 2xl:px-3 py-1 font-bold tracking-normal transition-all uppercase border-b-2 text-[13.5px] xl:text-[14.5px] 2xl:text-[15.5px] ${
                          isActive
                            ? "text-nepal-red border-nepal-red"
                            : "text-gray-800 border-transparent hover:text-nepal-red hover:border-nepal-red"
                        }`}
                      >
                        {item.nepali}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

        </div>
      </nav>

      {/* MOBILE SLIDE-IN MENU */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <div
        className={`fixed top-0 right-0 w-80 h-full bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Mobile Menu Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-bold text-xl tracking-wide">
            <Image 
              src="/logo.png" 
              width={120} 
              height={30} 
              alt="KTM Post Logo" 
              className="h-7 w-auto object-contain"
            />
          </span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
            aria-label="Close Menu"
          >
            <X className="w-6 h-6 text-gray-700" />
          </button>
        </div>

        {/* Mobile Search Box in Menu */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
          <SearchDropdown variant="inline" />
        </div>

        {/* Mobile Menu Navigation Items */}
        <div className="py-3 overflow-y-auto flex-1">
          <ul className="flex flex-col px-3 gap-1">
            {categories.map((cat) => {
              const isHome = cat.slug === "/";
              const href = isHome ? "/" : `/${cat.slug}`;
              const isActive = isHome ? pathname === "/" : pathname.startsWith(`/${cat.slug}`);
              return (
                <li key={cat.slug}>
                  <Link
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2.5 rounded-lg text-base font-semibold transition-colors ${
                      isActive
                        ? "bg-red-50 text-nepal-red"
                        : "text-gray-800 hover:bg-gray-50 hover:text-nepal-red"
                    }`}
                  >
                    {cat.nepali}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </header>
  );
}
