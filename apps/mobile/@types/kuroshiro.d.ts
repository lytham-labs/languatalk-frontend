declare module 'kuroshiro' {
    export default class Kuroshiro {
        Util: any;
        _analyzer: any;
        constructor();
        init(analyzer: any): Promise<void>;
        convert(text: string, options: {
            mode: string;
            to: string;
            romajiSystem?: string;
            delimiter_start?: string;
            delimiter_end?: string;
        }): Promise<string>;
        
        static Util: {
            hasJapanese(text: string): boolean;
            hasKanji(text: string): boolean;
            isKanji(char: string): boolean;
            isJapanese(char: string): boolean;
        };
    }
}