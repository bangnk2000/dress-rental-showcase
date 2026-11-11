import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Stacked rows below md (cms-mobile-ux D2) — opt-in, default behaviour unchanged.
 *
 *   <Table stacked>                      → below 768px every row is a 2-column grid block,
 *                                          the header row is visually hidden (still in the DOM)
 *   <TableCell stack="title">            → spans the row, bold, no label (the row's "name")
 *   <TableCell label={t('…phone')}>      → small column label printed above the value
 *   <TableCell stack="full" label="…">   → spans both grid columns (long values)
 *   <TableCell stack="actions">          → spans the row, children laid out as a wrapping
 *                                          button row (put the buttons directly in the cell)
 *
 * ONE DOM for every width: no element is added or removed, only CSS changes. Because a
 * `display` change drops native table semantics in Safari/VoiceOver, a stacked table spells
 * out the SAME roles the elements have implicitly (table/rowgroup/row/columnheader/cell), so
 * Testing Library and Playwright role queries behave identically. An explicit `role` prop on a
 * part still wins (e.g. a row-header <th> in the body). The label itself is a CSS ::before
 * (index.css, `table[data-stacked] td[data-label]`) — it is not an extra DOM node.
 * Hiding a column on phones: put `max-md:hidden` on its <TableCell> (the header is sr-only).
 */

const StackedContext = React.createContext(false)

function Table({
  className,
  stacked = false,
  ...props
}: React.ComponentProps<"table"> & { stacked?: boolean }) {
  return (
    <StackedContext.Provider value={stacked}>
      <div
        data-slot="table-container"
        className={cn(
          "relative w-full overflow-x-auto",
          stacked && "max-md:overflow-x-visible"
        )}
      >
        <table
          data-slot="table"
          {...(stacked ? { role: "table", "data-stacked": "" } : {})}
          className={cn(
            "w-full caption-bottom text-sm",
            stacked && "max-md:block",
            className
          )}
          {...props}
        />
      </div>
    </StackedContext.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  const stacked = React.useContext(StackedContext)
  return (
    <thead
      data-slot="table-header"
      {...(stacked ? { role: "rowgroup" } : {})}
      className={cn("[&_tr]:border-b", stacked && "max-md:sr-only", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  const stacked = React.useContext(StackedContext)
  return (
    <tbody
      data-slot="table-body"
      {...(stacked ? { role: "rowgroup" } : {})}
      className={cn(
        "[&_tr:last-child]:border-0",
        stacked && "max-md:block",
        className
      )}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  const stacked = React.useContext(StackedContext)
  return (
    <tfoot
      data-slot="table-footer"
      {...(stacked ? { role: "rowgroup" } : {})}
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        stacked && "max-md:block",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  const stacked = React.useContext(StackedContext)
  return (
    <tr
      data-slot="table-row"
      {...(stacked ? { role: "row" } : {})}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        stacked &&
          "max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-2 max-md:py-3",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  const stacked = React.useContext(StackedContext)
  return (
    <th
      data-slot="table-head"
      {...(stacked ? { role: "columnheader" } : {})}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

type StackPlacement = "title" | "full" | "actions"

const stackedCellClass: Record<StackPlacement | "half", string> = {
  half: "",
  full: "max-md:col-span-2",
  title: "max-md:col-span-2 max-md:text-base max-md:font-semibold",
  actions: "max-md:col-span-2 max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-2",
}

function TableCell({
  className,
  label,
  stack,
  ...props
}: React.ComponentProps<"td"> & {
  /** Column label shown above the value in a stacked row (phone). Ignored for `stack="title"`. */
  label?: string
  /** Placement inside a stacked row; omit for a regular half-width labelled field. */
  stack?: StackPlacement
}) {
  const stacked = React.useContext(StackedContext)
  const showLabel = stacked && label !== undefined && stack !== "title"
  return (
    <td
      data-slot="table-cell"
      {...(stacked ? { role: "cell" } : {})}
      {...(showLabel ? { "data-label": label } : {})}
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        stacked &&
          "max-md:block max-md:min-w-0 max-md:p-0 max-md:text-left max-md:break-words max-md:whitespace-normal",
        stacked && stackedCellClass[stack ?? "half"],
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
