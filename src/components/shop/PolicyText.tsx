type PolicyTextProps = {
  content: string;
  htmlEnabled: boolean;
};

export default function PolicyText({ content, htmlEnabled }: PolicyTextProps) {
  if (htmlEnabled) {
    return (
      <div
        className="text-sm leading-7 text-neutral-700 [&_a]:underline [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return <div className="whitespace-pre-line text-sm leading-7 text-neutral-700">{content}</div>;
}
