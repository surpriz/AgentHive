declare global {
  namespace App {
    interface Locals {
      author: { id: string; email: string; name: string } | null;
    }
  }
}

export {};
