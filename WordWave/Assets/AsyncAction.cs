using System.Collections.Concurrent;

    public static class AsyncActions
    {
        public static readonly ConcurrentQueue<string> TextsToAdd = new ConcurrentQueue<string>();

        public static void AddText(string text)
        {
            TextsToAdd.Enqueue(text);
        }

        public static string GetText()
        {
            TextsToAdd.TryDequeue(out var text);

            return text;
        }
    }
