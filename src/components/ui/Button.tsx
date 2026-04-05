import Link from "next/link";
import { ReactNode } from "react";

interface ButtonProps {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "outline";
  external?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function Button({
  href,
  children,
  variant = "primary",
  external,
  className = "",
  onClick,
}: ButtonProps) {
  const base =
    "inline-block px-4 py-2 text-xs tracking-[0.15em] font-semibold transition-all duration-200 cursor-pointer";
  
  const variants = {
    primary:
      "bg-black text-white border border-black hover:bg-white hover:text-black",
    outline:
      "bg-transparent text-black border border-black hover:bg-black hover:text-white",
  };

  const cls = `${base} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={cls}
      >
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} onClick={onClick}>
      {children}
    </button>
  );
}