export function Pagination({
  page,
  pages,
  total,
  limit,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{" "}
        {total} tasks
      </span>
      <div>
        <button
          className="secondary"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          className="secondary"
          disabled={page === pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
