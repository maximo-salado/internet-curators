interface Post {
  title: string;
  link: string;
  date: string;
}

export function PostsSection({ posts }: { posts: Post[] }) {
  if (!posts || posts.length === 0) {
    return <p className="text-xs text-zinc-600">No recent posts found.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {posts.map((post, i) => (
        <li key={i} className="text-xs text-zinc-400">
          <a
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-200 hover:underline"
          >
            {post.title}
          </a>
          {post.date && (
            <span className="ml-2 text-zinc-600">
              {new Date(post.date).toLocaleDateString()}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
