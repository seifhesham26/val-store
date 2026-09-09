"use client";

/**
 * Admin Settings Page
 *
 * Hub for all site configuration with tabbed navigation.
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Home, Store, Palette, Star, Truck } from "lucide-react";
import {
  HomepageSettings,
  StoreSettings,
  AppearanceSettings,
  FeaturedSettings,
  ShippingSettings,
} from "@/components/admin/settings";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("homepage");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your store configuration and content
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="homepage" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Homepage</span>
          </TabsTrigger>
          <TabsTrigger value="store" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Store</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="featured" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Featured</span>
          </TabsTrigger>
          <TabsTrigger value="shipping" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Shipping</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="homepage" className="space-y-6">
          <HomepageSettings />
        </TabsContent>

        <TabsContent value="store" className="space-y-6">
          <StoreSettings />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="featured" className="space-y-6">
          <FeaturedSettings />
        </TabsContent>

        <TabsContent value="shipping" className="space-y-6">
          <ShippingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
