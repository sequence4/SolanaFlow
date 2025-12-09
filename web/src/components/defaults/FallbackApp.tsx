"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function FallbackApp() {
  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Solana Program</CardTitle>
          <CardDescription>Waiting for program to be built...</CardDescription>
          <div className="flex justify-end">
            <WalletMultiButton />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Your program is being generated. Please wait for the build to complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}