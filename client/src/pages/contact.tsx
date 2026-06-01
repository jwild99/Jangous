import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Mail, Copy, Check } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppNavbar } from "@/components/AppNavbar";

export default function Contact() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("jango.us@outlook.com");
    setCopied(true);
    toast({
      title: "Email copied!",
      description: "The email address has been copied to your clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen glass-bg">
      <AppNavbar />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="flex flex-col items-center justify-center space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-16 h-16 text-primary" />
            <h1 className="text-5xl font-bold font-display">Jango.us</h1>
          </div>

          {/* Contact Card */}
          <Card className="card-depth w-full max-w-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl flex items-center justify-center gap-2">
                <Mail className="w-8 h-8 text-primary" />
                Contact Us
              </CardTitle>
              <CardDescription className="text-lg">
                Get in touch with the Jango.us team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Section */}
              <div className="flex flex-col items-center space-y-4 p-6 rounded-lg bg-muted/50">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">
                    Email Address
                  </p>
                  <p 
                    className="text-2xl font-bold text-primary font-mono"
                    data-testid="text-email"
                  >
                    jango.us@outlook.com
                  </p>
                </div>
                
                <Button
                  onClick={handleCopyEmail}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-copy-email"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Email
                    </>
                  )}
                </Button>

                <a
                  href="mailto:jango.us@outlook.com"
                  className="w-full"
                >
                  <Button 
                    variant="default" 
                    className="w-full gap-2"
                    data-testid="button-send-email"
                  >
                    <Mail className="w-4 h-4" />
                    Send Email
                  </Button>
                </a>
              </div>

              {/* Additional Info */}
              <div className="text-center space-y-2 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  We typically respond within 24-48 hours
                </p>
                <p className="text-xs text-muted-foreground">
                  For urgent matters, please include "URGENT" in your subject line
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Back to Lobby */}
          <Link href="/">
            <Button variant="ghost" data-testid="button-back-lobby">
              ← Back to Lobby
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
