<template>
    <div class="space-y-6">
        <!-- Buttons -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Button</h3>
            <div class="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
                <Button disabled>Disabled</Button>
            </div>
        </section>

        <Separator />

        <!-- Badges -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Badge</h3>
            <div class="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
            </div>
        </section>

        <Separator />

        <!-- Alert -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Alert</h3>
            <div class="space-y-2">
                <Alert>
                    <AlertTitle>Default Alert</AlertTitle>
                    <AlertDescription>This is a default alert message.</AlertDescription>
                </Alert>
                <Alert variant="warning">
                    <AlertTitle>Warning Alert</AlertTitle>
                    <AlertDescription>This is a warning alert message.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                    <AlertTitle>Destructive Alert</AlertTitle>
                    <AlertDescription>This is a destructive alert message.</AlertDescription>
                </Alert>
            </div>
        </section>

        <Separator />

        <!-- Card -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Card</h3>
            <Card class="max-w-md">
                <CardHeader>
                    <CardTitle>Card Title</CardTitle>
                    <CardDescription>Card description text goes here.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p class="text-sm text-muted-foreground">
                        This is the card content area.
                    </p>
                </CardContent>
                <CardFooter class="gap-2">
                    <Button variant="outline" size="sm">Cancel</Button>
                    <Button size="sm">Save</Button>
                </CardFooter>
            </Card>
        </section>

        <Separator />

        <!-- Inputs -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Input</h3>
            <div class="max-w-sm space-y-3">
                <Input placeholder="Default input" />
                <Input placeholder="Disabled input" disabled />
                <Textarea placeholder="Textarea input" rows="3" />
            </div>
        </section>

        <Separator />

        <!-- Checkbox / Switch -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Checkbox &amp; Switch</h3>
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-2">
                    <Checkbox id="gallery-cb1" />
                    <label for="gallery-cb1" class="text-sm">Checkbox</label>
                </div>
                <div class="flex items-center gap-2">
                    <Checkbox id="gallery-cb2" checked />
                    <label for="gallery-cb2" class="text-sm">Checked</label>
                </div>
                <div class="flex items-center gap-2">
                    <Switch id="gallery-sw1" />
                    <label for="gallery-sw1" class="text-sm">Switch</label>
                </div>
            </div>
        </section>

        <Separator />

        <!-- Progress -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Progress</h3>
            <div class="max-w-sm space-y-2">
                <Progress :model-value="25" />
                <Progress :model-value="50" />
                <Progress :model-value="75" />
                <Progress :model-value="100" />
            </div>
        </section>

        <Separator />

        <!-- Skeleton -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Skeleton</h3>
            <div class="max-w-sm space-y-3">
                <div class="flex items-center gap-4">
                    <Skeleton class="h-12 w-12 rounded-full" />
                    <div class="space-y-2">
                        <Skeleton class="h-4 w-[250px]" />
                        <Skeleton class="h-4 w-[200px]" />
                    </div>
                </div>
            </div>
        </section>

        <Separator />

        <!-- Spinner -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Spinner</h3>
            <div class="flex items-center gap-4">
                <Spinner class="size-4" />
                <Spinner class="size-6" />
                <Spinner class="size-8" />
            </div>
        </section>

        <Separator />

        <!-- Toggle -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Toggle</h3>
            <div class="flex flex-wrap gap-2">
                <Toggle variant="outline">Toggle</Toggle>
                <Toggle variant="outline" data-state="on">Active</Toggle>
                <Toggle variant="default">Default</Toggle>
            </div>
        </section>

        <Separator />

        <!-- Radio Group -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Radio Group</h3>
            <RadioGroup default-value="option1" class="max-w-sm">
                <div class="flex items-center gap-2">
                    <RadioGroupItem value="option1" id="gallery-r1" />
                    <label for="gallery-r1" class="text-sm">Option 1</label>
                </div>
                <div class="flex items-center gap-2">
                    <RadioGroupItem value="option2" id="gallery-r2" />
                    <label for="gallery-r2" class="text-sm">Option 2</label>
                </div>
                <div class="flex items-center gap-2">
                    <RadioGroupItem value="option3" id="gallery-r3" />
                    <label for="gallery-r3" class="text-sm">Option 3</label>
                </div>
            </RadioGroup>
        </section>

        <Separator />

        <!-- Tabs -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Tabs</h3>
            <Tabs default-value="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                    <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">
                    <p class="text-sm text-muted-foreground p-2">Content for Tab 1</p>
                </TabsContent>
                <TabsContent value="tab2">
                    <p class="text-sm text-muted-foreground p-2">Content for Tab 2</p>
                </TabsContent>
                <TabsContent value="tab3">
                    <p class="text-sm text-muted-foreground p-2">Content for Tab 3</p>
                </TabsContent>
            </Tabs>
        </section>

        <Separator />

        <!-- KBD -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">KBD (Keyboard)</h3>
            <div class="flex flex-wrap gap-2">
                <Kbd>Ctrl</Kbd>
                <Kbd>C</Kbd>
                <Kbd>V</Kbd>
                <span class="text-sm text-muted-foreground">→</span>
                <Kbd>Ctrl</Kbd> + <Kbd>V</Kbd>
            </div>
        </section>
    </div>
</template>

<script setup>
    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Input } from '@/components/ui/input';
    import { Kbd } from '@/components/ui/kbd';
    import { Progress } from '@/components/ui/progress';
    import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
    import { Separator } from '@/components/ui/separator';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Spinner } from '@/components/ui/spinner';
    import { Switch } from '@/components/ui/switch';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { Textarea } from '@/components/ui/textarea';
    import { Toggle } from '@/components/ui/toggle';
</script>
