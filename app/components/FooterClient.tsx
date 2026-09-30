"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { WPFooterPage } from "@/lib/wordpress";

interface FooterClientProps {
  footerPages: WPFooterPage[];
  settings?: Record<string, string>;
}

export default function FooterClient({ footerPages, settings = {} }: FooterClientProps) {
  const currentYear = new Date().getFullYear();

  const companyLegal =
    settings.company_name_legal ||
    "डिजी भिजन प्रा. लि., सूचना विभाग द.नं. ५३१६-२०८२/०८३";
  const officeAddress = settings.office_address || "Sukedhara, Kathmandu, Nepal";
  const contactEmail = settings.contact_email || "info@ktmpost.com";
  const contactPhone = settings.contact_phone || "9851320822";

  // Fallback links if no WP footer pages returned
  const defaultLinks = [
    { title: "About Us", slug: "about-us" },
    { title: "Advertise", slug: "advertise" },
    { title: "Privacy Policy", slug: "privacy-policy" },
    { title: "Terms of Service", slug: "terms-of-service" },
    { title: "Accessibility", slug: "accessibility" },
    { title: "Contact", slug: "contact" },
  ];

  const linksToRender =
    footerPages && footerPages.length > 0
      ? footerPages.map((page) => ({ title: page.title, slug: page.slug }))
      : defaultLinks;

  return (
    <footer className="bg-[#f2f2f0] border-t-4 border-transparent w-full mt-20 relative">
      {/* Two-tone accent bar matching logo colors */}
      <div className="w-full h-1 flex">
       
      </div>

      <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 py-10 md:py-14 flex flex-col md:flex-row items-center md:justify-between gap-8">
        {/* Brand & Company Information */}
        <div className="flex flex-col items-center md:items-start gap-3">
          <Link href="/">
            <Image
              src="/logo.png"
              width={130}
              height={32}
              alt="KTM Post"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <div className="text-xs text-gray-600 font-poppins text-center md:text-left leading-relaxed space-y-1">
            <p className="font-medium text-gray-700 font-nepali-serif text-sm">
              {companyLegal}
            </p>
            <p className="text-gray-500">
              {officeAddress}
            </p>
            <p className="text-gray-500">
              Email:{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="hover:text-nepal-red underline transition-colors"
              >
                {contactEmail}
              </a>
              {" "}| Mobile:{" "}
              <a
                href={`tel:${contactPhone}`}
                className="hover:text-nepal-red underline transition-colors"
              >
                {contactPhone}
              </a>
            </p>
            <p className="text-[11px] text-gray-400 pt-1">
              &copy; {currentYear} KTM Post. All rights reserved.
            </p>
          </div>
        </div>
        {/* Quick Links */}
        <div className="flex flex-col items-center md:items-end gap-3">
          <ul className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            {linksToRender.map((link) => (
              <li key={link.slug}>
                <Link
                  href={`/page/${link.slug}`}
                  className="hover:text-nepal-red transition-colors duration-200"
                >
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-gray-400 font-poppins tracking-wide">
            KTM Post is free to all, thanks to readers like you. 
          </p>
        </div>
      </div>
    </footer>
  );
}
