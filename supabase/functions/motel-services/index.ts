import {createClient} from 'npm:@supabase/supabase-js@2.117.0';
import {createHandler} from './handler.ts';
Deno.serve(createHandler({env:name=>Deno.env.get(name),createClient:(url,key)=>createClient(url,key,{auth:{persistSession:false}})}));
