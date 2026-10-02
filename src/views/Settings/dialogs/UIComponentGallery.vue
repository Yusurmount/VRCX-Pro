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
                    <p class="text-sm text-muted-foreground">This is the card content area.</p>
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

        <!-- Radio Card -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Radio Card</h3>
            <RadioGroup default-value="card1" class="max-w-sm grid gap-2">
                <RadioCard
                    id="gallery-rc1"
                    value="card1"
                    title="Card option 1"
                    description="Whole card is clickable and the checked card follows the radio state" />
                <RadioCard id="gallery-rc2" value="card2" title="Card option 2" description="Description is optional" />
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
        <Separator />

        <!-- Alert Dialog -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">AlertDialog</h3>
            <AlertDialog>
                <AlertDialogTrigger as-child>
                    <Button variant="outline">Delete item</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The item will be removed permanently.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>

        <Separator />

        <!-- Avatar -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Avatar</h3>
            <div class="flex items-center gap-4">
                <Avatar class="size-10">
                    <AvatarFallback>VX</AvatarFallback>
                </Avatar>
                <Avatar class="size-10">
                    <AvatarFallback><User class="size-5 text-muted-foreground" /></AvatarFallback>
                </Avatar>
                <Avatar class="size-12">
                    <AvatarFallback class="text-sm">LG</AvatarFallback>
                </Avatar>
            </div>
        </section>

        <Separator />

        <!-- Breadcrumb -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Breadcrumb</h3>
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink as-child>
                            <Button variant="ghost" size="sm">Home</Button>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink as-child>
                            <Button variant="ghost" size="sm">Settings</Button>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>UI Gallery</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
        </section>

        <Separator />

        <!-- Button Group -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">ButtonGroup</h3>
            <div class="flex flex-wrap items-start gap-4">
                <ButtonGroup>
                    <Button variant="outline">Left</Button>
                    <Button variant="outline">Middle</Button>
                    <Button variant="outline">Right</Button>
                </ButtonGroup>
                <ButtonGroup orientation="vertical">
                    <Button variant="outline">Up</Button>
                    <Button variant="outline">Down</Button>
                </ButtonGroup>
            </div>
        </section>

        <Separator />

        <!-- Calendar -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Calendar</h3>
            <Calendar class="w-fit" />
        </section>

        <Separator />

        <!-- Carousel -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Carousel</h3>
            <div class="relative w-full max-w-md">
                <Carousel>
                    <CarouselContent class="h-32">
                        <CarouselItem v-for="n in 4" :key="n">
                            <div
                                class="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                                Slide {{ n }}
                            </div>
                        </CarouselItem>
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                </Carousel>
            </div>
        </section>

        <Separator />

        <!-- Collapsible -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Collapsible</h3>
            <Collapsible v-slot="{ open }" class="w-full max-w-sm space-y-2">
                <div class="flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium">
                    <span>@vrcx starred 3 repositories</span>
                    <CollapsibleTrigger as-child>
                        <Button variant="ghost" size="sm">{{ open ? 'Hide' : 'Show' }}</Button>
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent class="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    vrcx-pro / vrcx-pro — friendship management tool for VRChat.
                </CollapsibleContent>
            </Collapsible>
        </section>

        <Separator />

        <!-- Command -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Command</h3>
            <Command class="w-full max-w-sm rounded-lg border">
                <CommandInput placeholder="Type a command…" />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Suggestions">
                        <CommandItem value="calendar">Calendar</CommandItem>
                        <CommandItem value="search">Search</CommandItem>
                        <CommandItem value="settings">Settings</CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading="History">
                        <CommandItem value="import">Import</CommandItem>
                        <CommandItem value="export">Export</CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </section>

        <Separator />

        <!-- Context Menu -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">ContextMenu</h3>
            <ContextMenu>
                <ContextMenuTrigger as-child>
                    <div
                        class="flex h-28 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                        Right-click me
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuLabel>Actions</ContextMenuLabel>
                    <ContextMenuItem>Open</ContextMenuItem>
                    <ContextMenuItem inset>
                        Save
                        <ContextMenuShortcut>⌘S</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </section>

        <Separator />

        <!-- Data Table -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">DataTable</h3>
            <DataTableEmpty type="nomatch" class="max-w-md" />
        </section>

        <Separator />

        <!-- Dialog -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Dialog</h3>
            <Dialog>
                <DialogTrigger as-child>
                    <Button variant="outline">Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit profile</DialogTitle>
                        <DialogDescription>Make changes to your profile here.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-2">
                        <Label for="gallery-dialog-name">Name</Label>
                        <Input id="gallery-dialog-name" placeholder="Name" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline">Cancel</Button>
                        <Button>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>

        <Separator />

        <!-- Dropdown Menu -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">DropdownMenu</h3>
            <DropdownMenu>
                <DropdownMenuTrigger as-child>
                    <Button variant="outline">Options</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuItem inset>Profile</DropdownMenuItem>
                    <DropdownMenuItem inset>Billing</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">Log out</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </section>

        <Separator />

        <!-- Empty -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Empty</h3>
            <Empty class="max-w-md">
                <EmptyHeader>
                    <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                    <EmptyTitle>No results</EmptyTitle>
                    <EmptyDescription>Try adjusting your search or filters.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" size="sm">Reset filters</Button>
                </EmptyContent>
            </Empty>
        </section>

        <Separator />

        <!-- Field -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Field</h3>
            <div class="max-w-md space-y-4">
                <Field orientation="horizontal">
                    <FieldLabel class="w-24">Email</FieldLabel>
                    <FieldContent>
                        <Input type="email" placeholder="you@example.com" />
                        <FieldDescription>We'll never share your email.</FieldDescription>
                    </FieldContent>
                </Field>
                <Field>
                    <FieldLabel>Name</FieldLabel>
                    <FieldContent>
                        <Input placeholder="Display name" />
                    </FieldContent>
                </Field>
            </div>
        </section>

        <Separator />

        <!-- Form -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Form</h3>
            <div class="max-w-md">
                <Form class="space-y-4" @submit="onFormSubmit">
                    <FormField v-slot="{ componentField }" name="email" :rules="validateEmail">
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="you@example.com" v-bind="componentField" />
                            </FormControl>
                            <FormDescription>We'll never share your email.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    </FormField>
                    <div class="flex items-center gap-3">
                        <Button type="submit">Submit</Button>
                        <span v-if="formSubmitted" class="text-sm text-muted-foreground"> Submitted. </span>
                    </div>
                </Form>
            </div>
        </section>

        <Separator />

        <!-- Hover Card -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">HoverCard</h3>
            <HoverCard>
                <HoverCardTrigger as-child>
                    <Button variant="link">@vrcx</Button>
                </HoverCardTrigger>
                <HoverCardContent>
                    <div class="text-sm font-semibold">VRCX</div>
                    <p class="text-sm text-muted-foreground">A desktop client for VRChat.</p>
                </HoverCardContent>
            </HoverCard>
        </section>

        <Separator />

        <!-- Input Group -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">InputGroup</h3>
            <div class="max-w-sm space-y-3">
                <InputGroup>
                    <InputGroupAddon align="inline-start"><AtSign /></InputGroupAddon>
                    <InputGroupInput placeholder="username" />
                    <InputGroupButton size="icon-sm" variant="ghost"><X /></InputGroupButton>
                </InputGroup>
                <InputGroupSearch v-model="inputGroupQuery" placeholder="Search…" />
            </div>
        </section>

        <Separator />

        <!-- Input OTP -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">InputOTP</h3>
            <InputOTP v-model="otpValue" :maxlength="6" inputmode="numeric">
                <InputOTPGroup>
                    <InputOTPSlot v-for="i in 6" :key="i - 1" :index="i - 1" />
                </InputOTPGroup>
            </InputOTP>
        </section>

        <Separator />

        <!-- Item -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Item</h3>
            <ItemGroup class="max-w-md">
                <Item variant="outline">
                    <ItemMedia variant="icon"><Folder /></ItemMedia>
                    <ItemContent>
                        <ItemTitle>Project proposal</ItemTitle>
                        <ItemDescription>Edited 2 hours ago</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <Button size="icon-sm" variant="ghost"><Ellipsis /></Button>
                    </ItemActions>
                </Item>
                <ItemSeparator />
                <Item variant="muted" size="sm">
                    <ItemMedia variant="icon"><Folder /></ItemMedia>
                    <ItemContent>
                        <ItemTitle>Design assets</ItemTitle>
                        <ItemDescription>Edited yesterday</ItemDescription>
                    </ItemContent>
                </Item>
            </ItemGroup>
        </section>

        <Separator />

        <!-- Label -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Label</h3>
            <div class="flex items-center gap-2">
                <Label for="gallery-label-input">Label</Label>
                <Input id="gallery-label-input" placeholder="Paired input" class="w-48" />
            </div>
        </section>

        <Separator />

        <!-- Native Select -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">NativeSelect</h3>
            <NativeSelect v-model="nativeSelectValue" class="w-52">
                <NativeSelectOption value="apple">Apple</NativeSelectOption>
                <NativeSelectOption value="banana">Banana</NativeSelectOption>
                <NativeSelectOption value="blueberry">Blueberry</NativeSelectOption>
            </NativeSelect>
        </section>

        <Separator />

        <!-- Number Field -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">NumberField</h3>
            <NumberField v-model="numberValue" :min="0" :max="10" :step="1" class="w-40">
                <NumberFieldContent>
                    <NumberFieldDecrement />
                    <NumberFieldInput />
                    <NumberFieldIncrement />
                </NumberFieldContent>
            </NumberField>
        </section>

        <Separator />

        <!-- Pagination -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Pagination</h3>
            <Pagination v-model:page="paginationPage" :total="100" :items-per-page="10" :sibling-count="1" show-edges>
                <PaginationContent v-slot="{ items }">
                    <PaginationPrevious />
                    <template v-for="(item, index) in items" :key="index">
                        <PaginationItem
                            v-if="item.type === 'page'"
                            :value="item.value"
                            :is-active="item.value === paginationPage">
                            {{ item.value }}
                        </PaginationItem>
                        <PaginationEllipsis v-else />
                    </template>
                    <PaginationNext />
                </PaginationContent>
            </Pagination>
        </section>

        <Separator />

        <!-- Popover -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Popover</h3>
            <Popover>
                <PopoverTrigger as-child>
                    <Button variant="outline">Open popover</Button>
                </PopoverTrigger>
                <PopoverContent class="w-64 p-4">
                    <p class="text-sm">Popover content goes here.</p>
                </PopoverContent>
            </Popover>
        </section>

        <Separator />

        <!-- Range Calendar -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">RangeCalendar</h3>
            <RangeCalendar class="w-fit" />
        </section>

        <Separator />

        <!-- Resizable -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Resizable</h3>
            <div class="h-40 w-full max-w-md rounded-md border">
                <ResizablePanelGroup direction="horizontal" class="h-full">
                    <ResizablePanel :default-size="50" :min-size="20">
                        <div class="flex h-full items-center justify-center text-sm text-muted-foreground">Panel A</div>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel :default-size="50" :min-size="20">
                        <div class="flex h-full items-center justify-center text-sm text-muted-foreground">Panel B</div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </section>

        <Separator />

        <!-- Scroll Area -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">ScrollArea</h3>
            <ScrollArea class="h-40 w-72 rounded-md border p-4">
                <p v-for="n in 20" :key="n" class="text-sm text-muted-foreground">
                    Line {{ n }} of scrollable content.
                </p>
            </ScrollArea>
        </section>

        <Separator />

        <!-- Select -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Select</h3>
            <Select v-model="selectValue">
                <SelectTrigger class="w-48">
                    <SelectValue placeholder="Select a fruit" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Fruits</SelectLabel>
                        <SelectItem value="apple">Apple</SelectItem>
                        <SelectItem value="banana">Banana</SelectItem>
                        <SelectItem value="blueberry">Blueberry</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
        </section>

        <Separator />

        <!-- Sheet -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Sheet</h3>
            <Sheet>
                <SheetTrigger as-child>
                    <Button variant="outline">Open sheet</Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Edit profile</SheetTitle>
                        <SheetDescription>Make changes to your profile here.</SheetDescription>
                    </SheetHeader>
                    <div class="px-4">
                        <Input placeholder="Name" />
                    </div>
                </SheetContent>
            </Sheet>
        </section>

        <Separator />

        <!-- Sidebar -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Sidebar</h3>
            <div class="h-56 w-full max-w-md overflow-hidden rounded-md border">
                <SidebarProvider :open="true" class="h-full">
                    <Sidebar collapsible="none" class="w-48">
                        <SidebarHeader class="border-b p-2">
                            <SidebarGroup>
                                <SidebarGroupLabel>Menu</SidebarGroupLabel>
                            </SidebarGroup>
                        </SidebarHeader>
                        <SidebarContent>
                            <SidebarGroup>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton is-active>
                                            <Home />
                                            <span>Home</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton>
                                            <Settings />
                                            <span>Settings</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroup>
                        </SidebarContent>
                    </Sidebar>
                    <SidebarInset class="p-4 text-sm text-muted-foreground">
                        <SidebarTrigger class="mb-2" />
                        Main content area
                    </SidebarInset>
                </SidebarProvider>
            </div>
        </section>

        <Separator />

        <!-- Slider -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Slider</h3>
            <div class="max-w-sm space-y-4">
                <Slider v-model="sliderValue" :min="0" :max="100" :step="1" />
                <Slider v-model="rangeSliderValue" :min="0" :max="100" :step="10" />
            </div>
        </section>

        <Separator />

        <!-- Sonner -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Sonner</h3>
            <div class="flex flex-wrap gap-2">
                <Button variant="outline" @click="toast('Plain notification')">Default</Button>
                <Button variant="outline" @click="toast.success('Saved!')">Success</Button>
                <Button variant="outline" @click="toast.error('Something went wrong')"> Error </Button>
            </div>
        </section>

        <Separator />

        <!-- Table -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Table</h3>
            <Table class="max-w-md">
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead class="text-right">Count</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow v-for="row in tableRows" :key="row.name">
                        <TableCell>{{ row.name }}</TableCell>
                        <TableCell>
                            <Badge variant="secondary">{{ row.status }}</Badge>
                        </TableCell>
                        <TableCell class="text-right tabular-nums">{{ row.count }}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </section>

        <Separator />

        <!-- Tags Input -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">TagsInput</h3>
            <TagsInput v-model="tagsValue" :max="6" class="max-w-sm">
                <TagsInputItem v-for="tag in tagsValue" :key="tag" :value="tag">
                    <TagsInputItemText />
                    <TagsInputItemDelete />
                </TagsInputItem>
                <TagsInputInput placeholder="Add tag…" />
            </TagsInput>
        </section>

        <Separator />

        <!-- Toggle Group -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">ToggleGroup</h3>
            <div class="flex flex-wrap items-center gap-4">
                <ToggleGroup v-model="toggleGroupValue" type="single" variant="outline">
                    <ToggleGroupItem value="7">7 days</ToggleGroupItem>
                    <ToggleGroupItem value="30">30 days</ToggleGroupItem>
                    <ToggleGroupItem value="90">90 days</ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup type="multiple" variant="outline">
                    <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
                    <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
                    <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
                </ToggleGroup>
            </div>
        </section>

        <Separator />

        <!-- Tooltip -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Tooltip</h3>
            <div class="flex flex-wrap items-center gap-3">
                <TooltipWrapper side="top" content="Top tooltip">
                    <Button variant="outline">Hover me</Button>
                </TooltipWrapper>
                <TooltipWrapper side="right" content="Right tooltip">
                    <Badge variant="outline">Badge</Badge>
                </TooltipWrapper>
                <Tooltip>
                    <TooltipTrigger as-child>
                        <Button variant="ghost">Low-level</Button>
                    </TooltipTrigger>
                    <TooltipContent>Low-level tooltip</TooltipContent>
                </Tooltip>
            </div>
        </section>

        <Separator />

        <!-- Tree -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">Tree</h3>
            <Tree
                :items="treeItems"
                :get-key="(item) => item.id"
                :get-children="(item) => item.children"
                :default-expanded="[1]"
                class="w-64 gap-0.5">
                <template #default="{ flattenItems }">
                    <TreeItem v-for="item in flattenItems" :key="item._id" :value="item.value" :level="item.level">
                        {{ item.value.label }}
                    </TreeItem>
                </template>
            </Tree>
        </section>

        <Separator />

        <!-- Virtual Combobox -->
        <section>
            <h3 class="text-sm font-semibold text-foreground mb-3">VirtualCombobox</h3>
            <VirtualCombobox
                v-model="comboboxValue"
                :groups="comboboxGroups"
                placeholder="Select a fruit"
                class="w-72" />
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
    import { RadioCard } from '@/components/ui/radio-card';
    import { Separator } from '@/components/ui/separator';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Spinner } from '@/components/ui/spinner';
    import { Switch } from '@/components/ui/switch';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { Textarea } from '@/components/ui/textarea';
    import { Toggle } from '@/components/ui/toggle';
    import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
        AlertDialogTrigger
    } from '@/components/ui/alert-dialog';
    import { Avatar, AvatarFallback } from '@/components/ui/avatar';
    import {
        Breadcrumb,
        BreadcrumbItem,
        BreadcrumbLink,
        BreadcrumbList,
        BreadcrumbPage,
        BreadcrumbSeparator
    } from '@/components/ui/breadcrumb';
    import { ButtonGroup } from '@/components/ui/button-group';
    import { Calendar } from '@/components/ui/calendar';
    import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
    import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
    import {
        Command,
        CommandEmpty,
        CommandGroup,
        CommandInput,
        CommandItem,
        CommandList,
        CommandSeparator
    } from '@/components/ui/command';
    import {
        ContextMenu,
        ContextMenuContent,
        ContextMenuItem,
        ContextMenuLabel,
        ContextMenuSeparator,
        ContextMenuShortcut,
        ContextMenuTrigger
    } from '@/components/ui/context-menu';
    import DataTableEmpty from '@/components/ui/data-table/DataTableEmpty.vue';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle,
        DialogTrigger
    } from '@/components/ui/dialog';
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuLabel,
        DropdownMenuSeparator,
        DropdownMenuTrigger
    } from '@/components/ui/dropdown-menu';
    import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
    import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
    import {
        Form,
        FormControl,
        FormDescription,
        FormField,
        FormItem,
        FormLabel,
        FormMessage
    } from '@/components/ui/form';
    import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
    import {
        InputGroup,
        InputGroupAddon,
        InputGroupButton,
        InputGroupInput,
        InputGroupSearch
    } from '@/components/ui/input-group';
    import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
    import {
        Item,
        ItemActions,
        ItemContent,
        ItemDescription,
        ItemGroup,
        ItemMedia,
        ItemSeparator,
        ItemTitle
    } from '@/components/ui/item';
    import { Label } from '@/components/ui/label';
    import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
    import {
        NumberField,
        NumberFieldContent,
        NumberFieldDecrement,
        NumberFieldIncrement,
        NumberFieldInput
    } from '@/components/ui/number-field';
    import {
        Pagination,
        PaginationContent,
        PaginationEllipsis,
        PaginationItem,
        PaginationNext,
        PaginationPrevious
    } from '@/components/ui/pagination';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { RangeCalendar } from '@/components/ui/range-calendar';
    import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import {
        Select,
        SelectContent,
        SelectGroup,
        SelectItem,
        SelectLabel,
        SelectTrigger,
        SelectValue
    } from '@/components/ui/select';
    import {
        Sheet,
        SheetContent,
        SheetDescription,
        SheetHeader,
        SheetTitle,
        SheetTrigger
    } from '@/components/ui/sheet';
    import {
        Sidebar,
        SidebarContent,
        SidebarGroup,
        SidebarGroupLabel,
        SidebarHeader,
        SidebarInset,
        SidebarMenu,
        SidebarMenuButton,
        SidebarMenuItem,
        SidebarProvider,
        SidebarTrigger
    } from '@/components/ui/sidebar';
    import { Slider } from '@/components/ui/slider';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import {
        TagsInput,
        TagsInputInput,
        TagsInputItem,
        TagsInputItemDelete,
        TagsInputItemText
    } from '@/components/ui/tags-input';
    import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
    import { Tooltip, TooltipContent, TooltipTrigger, TooltipWrapper } from '@/components/ui/tooltip';
    import { Tree, TreeItem } from '@/components/ui/tree';
    import { VirtualCombobox } from '@/components/ui/virtual-combobox';
    import { AtSign, Ellipsis, Folder, Home, Inbox, Settings, User, X } from 'lucide-vue-next';
    import { ref } from 'vue';
    import { toast } from 'vue-sonner';
    const tableRows = [
        { name: 'World launch', status: 'Active', count: 12 },
        { name: 'Avatar upload', status: 'Pending', count: 3 },
        { name: 'Group invite', status: 'Done', count: 47 }
    ];

    const treeItems = [
        {
            id: 1,
            label: 'Worlds',
            children: [
                { id: 2, label: 'Favorites' },
                { id: 3, label: 'Recent' }
            ]
        },
        {
            id: 4,
            label: 'Avatars',
            children: [{ id: 5, label: 'Equipped' }]
        }
    ];

    const comboboxGroups = [
        {
            key: 'fruits',
            label: 'Fruits',
            items: [
                { value: 'apple', label: 'Apple' },
                { value: 'banana', label: 'Banana' },
                { value: 'blueberry', label: 'Blueberry' },
                { value: 'cherry', label: 'Cherry' },
                { value: 'grape', label: 'Grape' },
                { value: 'kiwi', label: 'Kiwi' },
                { value: 'mango', label: 'Mango' },
                { value: 'orange', label: 'Orange' },
                { value: 'pear', label: 'Pear' },
                { value: 'strawberry', label: 'Strawberry' },
                { value: 'watermelon', label: 'Watermelon' }
            ]
        }
    ];

    const comboboxValue = ref('apple');
    const formSubmitted = ref(false);
    const inputGroupQuery = ref('');
    const nativeSelectValue = ref('apple');
    const numberValue = ref(5);
    const otpValue = ref('');
    const paginationPage = ref(1);
    const rangeSliderValue = ref([20, 80]);
    const selectValue = ref('apple');
    const sliderValue = ref([50]);
    const tagsValue = ref(['vue', 'ui']);
    const toggleGroupValue = ref('30');

    /**
     * @param {string} value
     * @returns {true | string}
     */
    function validateEmail(value) {
        if (!value) {
            return 'Email is required.';
        }
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a valid email address.';
    }

    /**
     *
     */
    function onFormSubmit() {
        formSubmitted.value = true;
    }
</script>
