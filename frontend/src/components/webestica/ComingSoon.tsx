export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="card card-body text-center py-5">
      <i className="bi bi-hourglass-split fs-1 text-primary mb-3" />
      <h5>{title}</h5>
      <p className="mb-0 text-body-secondary">{description}</p>
    </div>
  );
}
