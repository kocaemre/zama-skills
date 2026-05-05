@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 252 92% 60%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 252 92% 95%;
    --accent-foreground: 252 92% 30%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 252 92% 60%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 6% 10%;
    --card-foreground: 0 0% 98%;
    --primary: 252 92% 70%;
    --primary-foreground: 240 10% 3.9%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 252 50% 20%;
    --accent-foreground: 252 92% 90%;
    --destructive: 0 62.8% 50%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 18%;
    --input: 240 3.7% 18%;
    --ring: 252 92% 70%;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground antialiased font-sans;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  code,
  pre {
    @apply font-mono;
  }
}

@layer utilities {
  .gradient-mesh {
    background-image:
      radial-gradient(at 20% 0%, hsl(var(--primary) / 0.15) 0px, transparent 50%),
      radial-gradient(at 80% 100%, hsl(var(--accent) / 0.2) 0px, transparent 50%);
  }

  .text-balance {
    text-wrap: balance;
  }
}
