declare module 'vue-router' {
    interface _RouteRecordBase {
        hidden?: boolean | string | number;
        permissions?: string[];
        roles?: string[];
        alwaysShow?: boolean;
        query?: string;
        parentPath?: string;
    }
}

export {}