import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Admin table - hairline rows, header micro uppercase, hover halus.
 *
 * Konvensi bersama (kontrak tabel admin, audit F-06):
 * - Bungkus dengan <TableScroll> (overflow-x-auto) supaya kolom banyak tidak
 *   memecah lebar halaman. Bila kolom sedikit, Table boleh berdiri sendiri.
 * - Header kolom teks: `text-left` (bawaan TableHead).
 *   Header kolom angka: pakai `numeric` pada TableHead dan TableCell-nya.
 * - Tinggi baris: `py-3` adalah bawaan; untuk daftar sangat padat boleh
 *   diturunkan ke `py-2.5` lewat `className`, jangan nilai lain.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  ),
)
Table.displayName = "Table"

/** Pembungkus tabel yang bisa digulir horizontal (standar tabel admin). */
const TableScroll = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("w-full overflow-x-auto", className)} {...props} />
  ),
)
TableScroll.displayName = "TableScroll"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("border-b border-border", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border transition-colors duration-100 data-[state=selected]:bg-accent/60",
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = "TableRow"

interface TableAlignProps {
  /** Kolom angka: rata kanan dan pakai tabular-nums. */
  numeric?: boolean
}

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & TableAlignProps
>(({ className, numeric = false, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-4 text-left align-middle text-xs font-medium text-muted-foreground",
      numeric && "text-right tabular-nums",
      className,
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & TableAlignProps
>(({ className, numeric = false, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-3 align-middle text-[13px] text-foreground",
      numeric && "text-right tabular-nums",
      className,
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-3 text-xs text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
}
