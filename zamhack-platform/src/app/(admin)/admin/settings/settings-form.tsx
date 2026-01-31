"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { updatePlatformSettings } from "./actions"
import { Loader2, Save } from "lucide-react"

interface SettingsFormProps {
  initialSettings: {
    maintenance_mode: boolean
    allow_new_signups: boolean
    default_currency: string
  }
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(initialSettings.maintenance_mode)
  const [allowSignups, setAllowSignups] = useState(initialSettings.allow_new_signups)
  const [currency, setCurrency] = useState(initialSettings.default_currency)

  const handleSave = async () => {
    setIsLoading(true)
    
    const result = await updatePlatformSettings({
      maintenance_mode: maintenanceMode,
      allow_new_signups: allowSignups,
      default_currency: currency
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(result.success)
    }

    setIsLoading(false)
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Platform Configuration</CardTitle>
          <CardDescription>
            Control global settings for the ZamHack platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Maintenance Mode */}
          <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Disable access to the platform for all non-admin users.
              </p>
            </div>
            <Switch 
              checked={maintenanceMode} 
              onCheckedChange={setMaintenanceMode} 
            />
          </div>

          {/* Allow New Signups */}
          <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">Allow New Signups</Label>
              <p className="text-sm text-muted-foreground">
                If disabled, new users cannot register. Existing users can still log in.
              </p>
            </div>
            <Switch 
              checked={allowSignups} 
              onCheckedChange={setAllowSignups} 
            />
          </div>

          {/* Default Currency */}
          <div className="space-y-2">
            <Label htmlFor="currency">Default Currency</Label>
            <div className="w-[200px]">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHP">Philippine Peso (PHP)</SelectItem>
                  <SelectItem value="USD">US Dollar (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              This currency will be used as the default for new challenges.
            </p>
          </div>

        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}